#!/bin/bash
# Deploy all Weaviate Studio telemetry dashboards and alerts to Azure
# Usage: ./deploy.sh [--cleanup|--skip-cleanup]
# Prerequisites: az CLI logged in with access to subscription

# Exit on error, undefined variable, or pipe failure
set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SUBSCRIPTION_ID="${AZURE_SUBSCRIPTION_ID:-}"
RESOURCE_GROUP="weaviate-studio"
APP_INSIGHTS_NAME="weaviate.telemetry"
LOCATION="eastus"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Track deployment status
declare -a FAILED_DEPLOYMENTS=()
declare -a SUCCESSFUL_DEPLOYMENTS=()

# Logging functions
log_info() { echo -e "${NC}[INFO]  $*"; }
log_success() { echo -e "${GREEN}[OK]    $*${NC}"; }
log_warn() { echo -e "${YELLOW}[WARN]  $*${NC}"; }
log_error() { echo -e "${RED}[ERROR] $*${NC}" >&2; }

# Print usage
usage() {
    echo "Usage: $0 [--cleanup|--skip-cleanup]"
    echo ""
    echo "Options:"
    echo "  --cleanup       Delete all existing workbooks before deploying"
    echo "  --skip-cleanup  Deploy without deleting existing workbooks"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "If no option is provided, the script will prompt for choice."
    echo ""
    echo "Environment variables:"
    echo "  AZURE_SUBSCRIPTION_ID  Your Azure subscription ID (required)"
    exit 1
}

# Parse command-line arguments
CLEANUP_MODE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --cleanup)
            CLEANUP_MODE="cleanup"
            shift
            ;;
        --skip-cleanup)
            CLEANUP_MODE="skip-cleanup"
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            ;;
    esac
done

echo ""
log_info "=== Weaviate Studio Telemetry Dashboard Deploy ==="
echo ""

# Validate subscription ID
if [[ -z "$SUBSCRIPTION_ID" ]]; then
    log_error "Azure subscription ID required. Set AZURE_SUBSCRIPTION_ID environment variable."
    echo ""
    log_info "Example: AZURE_SUBSCRIPTION_ID=48547513-8fc4-420b-a6da-d81e8930e03d $0"
    echo ""
    log_info "Or use command-line flags:"
    echo "  $0 --cleanup        # Cleanup and deploy"
    echo "  $0 --skip-cleanup   # Deploy without cleanup"
    exit 1
fi

# Validate subscription ID format (basic UUID check)
if ! [[ "$SUBSCRIPTION_ID" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    log_warn "Subscription ID doesn't look like a valid UUID format"
    log_info "Continuing anyway..."
fi

log_info "Subscription: $SUBSCRIPTION_ID"
log_info "Resource Group: $RESOURCE_GROUP"
log_info "App Insights: $APP_INSIGHTS_NAME"
echo ""

# Verify az CLI is available
if ! command -v az &> /dev/null; then
    log_error "Azure CLI (az) is not installed."
    log_info "Install with: brew install azure-cli"
    exit 1
fi

# Verify logged in
if ! az account show &> /dev/null; then
    log_error "Not logged into Azure. Run: az login"
    exit 1
fi

# Get Application Insights resource ID
log_info "Fetching Application Insights resource..."
APPINSIGHTS_ID=$(az resource show \
    --subscription "$SUBSCRIPTION_ID" \
    -g "$RESOURCE_GROUP" \
    --resource-type microsoft.insights/components \
    -n "$APP_INSIGHTS_NAME" \
    --query 'id' -o tsv 2>/dev/null) || {
    log_error "Could not find Application Insights '$APP_INSIGHTS_NAME' in resource group '$RESOURCE_GROUP'"
    exit 1
}

log_success "Found AppInsights: $APPINSIGHTS_ID"
echo ""

# Function to validate JSON file
validate_json() {
    local json_file=$1
    local filename=$(basename "$json_file")
    
    if [[ ! -f "$json_file" ]]; then
        log_error "JSON file not found: $filename"
        return 1
    fi
    
    # Try to parse JSON with Python
    if ! python3 -c "import json; json.load(open('$json_file'))" 2>/dev/null; then
        log_error "Invalid JSON in: $filename"
        python3 -c "import json; json.load(open('$json_file'))" 2>&1 | head -3 >&2
        return 1
    fi
    
    return 0
}

# Function to cleanup ALL existing workbooks
cleanup_all_workbooks() {
    log_warn "Cleaning up all existing workbooks..."
    
    local failed_cleanup=0
    local existing=$(az rest --method GET \
        --uri "https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Insights/workbooks?api-version=2022-04-01&category=workbook" \
        --query "value[].id" -o tsv 2>/dev/null || true)
    
    if [[ -n "$existing" ]]; then
        local count=$(echo "$existing" | wc -l | tr -d ' ')
        log_info "Found $count existing workbook(s), deleting..."
        
        while IFS= read -r id; do
            [[ -z "$id" ]] && continue
            local wb_name=$(echo "$id" | rev | cut -d'/' -f1 | rev)
            log_info "  Deleting: $wb_name"
            if az rest --method DELETE \
                --uri "$id?api-version=2022-04-01" \
                --subscription "$SUBSCRIPTION_ID" 2>/dev/null; then
                log_info "  Deleted: $wb_name"
            else
                log_warn "  Failed to delete: $wb_name"
                ((failed_cleanup++))
            fi
        done <<< "$existing"
        
        if [[ $failed_cleanup -gt 0 ]]; then
            log_warn "$failed_cleanup workbook(s) failed to delete"
        else
            log_success "All workbooks deleted successfully"
        fi
        
        log_info "Waiting for deletions to propagate..."
        sleep 5
    else
        log_info "No existing workbooks found"
    fi
}

# Function to deploy a workbook from JSON file
deploy_workbook() {
    local name=$1
    local display_name=$2
    local json_file="$SCRIPT_DIR/$name.json"
    
    log_info "Deploying: $display_name..."
    
    # Validate JSON first
    if ! validate_json "$json_file"; then
        FAILED_DEPLOYMENTS+=("$display_name")
        return 1
    fi
    
    # Generate ARM template
    python3 -c "
import json, uuid, sys

try:
    with open('$json_file') as f:
        wb_data = json.load(f)
    
    serialized = json.dumps(wb_data, separators=(',', ':'))
    
    template = {
        '\$schema': 'https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#',
        'contentVersion': '1.0.0.0',
        'resources': [{
            'type': 'microsoft.insights/workbooks',
            'apiVersion': '2022-04-01',
            'name': str(uuid.uuid4()),
            'location': '$LOCATION',
            'kind': 'shared',
            'properties': {
                'displayName': '$display_name',
                'serializedData': serialized,
                'version': '1.0',
                'sourceId': '$APPINSIGHTS_ID',
                'category': 'workbook'
            }
        }]
    }
    
    with open('/tmp/arm_$name.json', 'w') as f:
        json.dump(template, f, indent=2)
except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)
" || {
        log_error "Failed to generate ARM template for: $display_name"
        FAILED_DEPLOYMENTS+=("$display_name")
        return 1
    }
    
    # Deploy to Azure
    if az deployment group create \
        --subscription "$SUBSCRIPTION_ID" \
        -g "$RESOURCE_GROUP" \
        --template-file "/tmp/arm_$name.json" \
        --name "deploy-wb-$name-$(date +%s)" \
        --only-show-errors 2>&1 > /dev/null; then
        log_success "$display_name"
        SUCCESSFUL_DEPLOYMENTS+=("$display_name")
        return 0
    else
        log_error "$display_name (deployment failed)"
        FAILED_DEPLOYMENTS+=("$display_name")
        return 1
    fi
}

# Handle cleanup mode
if [[ -z "$CLEANUP_MODE" ]]; then
    echo "Choose deployment mode:"
    echo "  1. Cleanup mode:  Delete ALL workbooks first, then deploy"
    echo "  2. Skip cleanup:  Deploy without deleting existing"
    read -p "Enter choice (1 or 2): " choice
    
    if [[ "$choice" == "1" ]]; then
        CLEANUP_MODE="cleanup"
    else
        CLEANUP_MODE="skip-cleanup"
    fi
fi

if [[ "$CLEANUP_MODE" == "cleanup" ]]; then
    cleanup_all_workbooks
fi

echo ""
log_info "=== Deploying Workbooks ==="
echo ""

# Deploy all workbooks
deploy_workbook "extension_health" "Extension Health"
deploy_workbook "feature_adoption" "Feature Adoption"
deploy_workbook "performance" "Performance"
deploy_workbook "error_analysis" "Error Analysis"
deploy_workbook "business_metrics" "Business Metrics"
deploy_workbook "version_platform" "Version & Platform Analytics"

# Cleanup temp files
rm -f /tmp/arm_*.json

echo ""
log_info "=== Deployment Summary ==="
echo ""

if [[ ${#SUCCESSFUL_DEPLOYMENTS[@]} -gt 0 ]]; then
    log_success "Successful deployments (${#SUCCESSFUL_DEPLOYMENTS[@]}):"
    for name in "${SUCCESSFUL_DEPLOYMENTS[@]}"; do
        echo -e "  ${GREEN}✓${NC} $name"
    done
    echo ""
fi

if [[ ${#FAILED_DEPLOYMENTS[@]} -gt 0 ]]; then
    log_error "Failed deployments (${#FAILED_DEPLOYMENTS[@]}):"
    for name in "${FAILED_DEPLOYMENTS[@]}"; do
        echo -e "  ${RED}✗${NC} $name"
    done
    echo ""
    log_error "Some deployments failed. Check Azure portal for details."
    exit 1
fi

echo ""
log_success "=== All Deployments Complete! ==="
echo ""
log_info "View dashboards at:"
echo "  https://portal.azure.com/#resource/$APPINSIGHTS_ID/workbooks"
echo ""
