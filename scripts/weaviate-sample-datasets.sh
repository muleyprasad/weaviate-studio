#!/usr/bin/env bash

if [ -z "${BASH_VERSION:-}" ]; then
  echo "This script must be run with bash. Try: bash $0 ..." >&2
  exit 1
fi

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE_DIR_DEFAULT="${SCRIPT_DIR}/../.weaviate-samples"
CACHE_DIR="${WEAVIATE_SAMPLE_CACHE:-$CACHE_DIR_DEFAULT}"
FORCE_REFRESH=0
ACTION="up"
DOCKER_COMPOSE_ARGS=()
TARGETS=()

# dataset_id|human label|docker-compose URL
DATASET_REGISTRY="news-contextionary|News Publications (contextionary)|https://raw.githubusercontent.com/weaviate/weaviate-examples/main/weaviate-contextionary-newspublications/docker-compose.yaml
wiki|Wikipedia semantic search (no GPU)|https://raw.githubusercontent.com/weaviate/semantic-search-through-wikipedia-with-weaviate/refs/heads/main/step-3/docker-compose-no-gpu.yml
wiki-gpu|Wikipedia semantic search (GPU)|https://raw.githubusercontent.com/weaviate/semantic-search-through-wikipedia-with-weaviate/refs/heads/main/step-3/docker-compose-gpu.yml"

ALL_TARGETS=(news wiki)

print_usage() {
  cat <<'USAGE'
Usage: weaviate-sample-datasets.sh [options] <dataset> [<dataset>...]

Manage local Weaviate demo dataset stacks via Docker Compose.

Options:
  --down                 Stop and remove the Docker Compose stack instead of starting it.
  --force-refresh        Re-download the upstream Docker Compose file even if cached locally.
  --list                 Show supported dataset identifiers and exit.
  --compose-arg <value>  Extra argument forwarded to `docker compose` (can be used multiple times).
  --wiki-backup          For wiki/wiki-gpu: download and mount the pre-vectorized Wikipedia backup (~112GB unpacked).
  --wiki-backup-url URL  Override Wikipedia backup tarball URL.
  -h, --help             Show this help text.

Datasets:
  news                   News Publications demo (contextionary variant).
  news-contextionary     Same as `news`.
  wiki                   Wikipedia semantic search (CPU).
  wiki-gpu               Wikipedia semantic search (GPU-enabled).
  all                    Convenience alias for: news, wiki.

Environment:
  WEAVIATE_SAMPLE_CACHE  Override the directory used to cache docker-compose files (default: repo/.weaviate-samples).

Examples:
  ./scripts/weaviate-sample-datasets.sh news
  ./scripts/weaviate-sample-datasets.sh --down news
  ./scripts/weaviate-sample-datasets.sh --force-refresh news wiki
  ./scripts/weaviate-sample-datasets.sh all
  ./scripts/weaviate-sample-datasets.sh --wiki-backup wiki  # downloads and mounts the ~112GB backup
USAGE
}

print_list() {
  echo "Available datasets:" >&2
  while IFS='|' read -r key label _; do
    [[ -n $key ]] || continue
    printf '  %-22s %s\n' "$key" "$label" >&2
  done <<<"$DATASET_REGISTRY"
}

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

die() {
  echo "Error: $*" >&2
  exit 1
}

ensure_prerequisites() {
  command -v curl >/dev/null 2>&1 || die "curl is required"
  if ! command -v docker >/dev/null 2>&1; then
    die "Docker is required. Install: https://docs.docker.com/get-docker/"
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "Docker Compose v2 is required (docker compose). See: https://docs.docker.com/compose/install/"
  fi
}

lookup_dataset_record() {
  local key="$1"
  while IFS='|' read -r id label url; do
    [[ -n $id ]] || continue
    if [[ $id == "$key" ]]; then
      printf '%s|%s|%s' "$id" "$label" "$url"
      return 0
    fi
  done <<<"$DATASET_REGISTRY"
  return 1
}

dataset_label() {
  local record
  record="$(lookup_dataset_record "$1")" || return 1
  echo "$record" | cut -d '|' -f2
}

dataset_url() {
  local record
  record="$(lookup_dataset_record "$1")" || return 1
  echo "$record" | cut -d '|' -f3
}

canonical_dataset() {
  case "$1" in
    news)
      echo "news-contextionary"
      ;;
    wiki-cpu)
      echo "wiki"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

resolve_targets() {
  local raw_targets=("$@")
  local expanded=()
  local seen_keys=""

  for item in "${raw_targets[@]}"; do
    case "$item" in
      all)
        expanded+=("${ALL_TARGETS[@]}")
        ;;
      *)
        expanded+=("$item")
        ;;
    esac
  done

  TARGETS=()
  for target in "${expanded[@]}"; do
    local canonical
    canonical="$(canonical_dataset "$target")"
    if ! lookup_dataset_record "$canonical" >/dev/null 2>&1; then
      die "Unsupported dataset: $target"
    fi
    case " $seen_keys " in
      *" $canonical "*)
        continue
        ;;
      *)
        TARGETS+=("$canonical")
        seen_keys+=" $canonical"
        ;;
    esac
  done
}

cache_compose_file() {
  local dataset="$1"
  local url="$2"
  local dataset_dir="$CACHE_DIR/$dataset"
  local compose_file="$dataset_dir/docker-compose.yaml"

  mkdir -p "$dataset_dir"

  if [[ $FORCE_REFRESH -eq 1 || ! -s $compose_file ]]; then
    log "Fetching docker-compose for $dataset from $url"
    curl -fsSL "$url" -o "$compose_file" || die "Failed to download compose file for $dataset"
  else
    log "Using cached compose file for $dataset"
  fi

  printf '%s\n' "$compose_file"
}

# Wikipedia backup support
WIKI_BACKUP=0
WIKI_BACKUP_URL_DEFAULT="https://storage.googleapis.com/semi-technologies-public-data/weaviate-1.8.0-rc.2-backup-wikipedia-py-en-multi-qa-MiniLM-L6-cos.tar.gz"
WIKI_BACKUP_URL="${WEAVIATE_WIKI_BACKUP_URL:-$WIKI_BACKUP_URL_DEFAULT}"

prepare_wiki_backup_override() {
  local dataset="$1" # wiki or wiki-gpu
  local dataset_dir="$CACHE_DIR/$dataset"
  local backup_dir="$dataset_dir/wiki-backup"
  local tar_name
  tar_name="$(basename "$WIKI_BACKUP_URL")"

  command -v tar >/dev/null 2>&1 || die "tar is required to extract the Wikipedia backup"

  mkdir -p "$backup_dir"

  if [[ ! -d "$backup_dir/var/weaviate" ]]; then
    log "Downloading Wikipedia backup (very large; ~112GB unpacked)"
    curl -fSL "$WIKI_BACKUP_URL" -o "$backup_dir/$tar_name"
    log "Extracting backup archive (this may take a while)"
    tar -xzf "$backup_dir/$tar_name" -C "$backup_dir"
  else
    log "Using existing Wikipedia backup at $backup_dir/var/weaviate"
  fi

  local host_path
  host_path="$(cd "$backup_dir" && pwd)/var/weaviate"
  local override_file="$dataset_dir/docker-compose.override.mount-backup.yml"

  cat > "$override_file" <<EOF
services:
  weaviate:
    volumes:
      - "$host_path:/var/lib/weaviate"
EOF

  printf '%s\n' "$override_file"
}

sanitise_project_name() {
  local dataset="$1"
  local name="weaviate-${dataset//[^a-zA-Z0-9]/-}"
  echo "$name"
}

run_compose() {
  local dataset="$1"
  local compose_file="$2"
  local extra_compose_file="${3:-}"
  local label
  local project_name
  local compose_cmd=(docker compose -f "$compose_file")
  if [[ -n "$extra_compose_file" ]]; then
    compose_cmd+=( -f "$extra_compose_file" )
  fi

  label="$(dataset_label "$dataset")" || label="$dataset"
  project_name="$(sanitise_project_name "$dataset")"

  if [[ ${#DOCKER_COMPOSE_ARGS[@]} -gt 0 ]]; then
    compose_cmd+=("${DOCKER_COMPOSE_ARGS[@]}")
  fi

  if [[ $ACTION == "up" ]]; then
    log "Starting $label"
    COMPOSE_PROJECT_NAME="$project_name" "${compose_cmd[@]}" up -d
    log "$label is starting (docker compose up -d)"
  else
    log "Stopping $label"
    COMPOSE_PROJECT_NAME="$project_name" "${compose_cmd[@]}" down
    log "$label has been stopped"
  fi
}

warn_port_collisions() {
  if [[ ${#TARGETS[@]} -le 1 ]]; then
    return
  fi
  log "Heads-up: upstream compose files default to exposing port 8080 on localhost."
  log "If multiple datasets are started simultaneously they may conflict on host ports."
  log "Adjust the cached compose files under $CACHE_DIR/<dataset>/docker-compose.yaml to customise ports."
}

main() {
  local args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --down)
        ACTION="down"
        shift
        ;;
      --force-refresh)
        FORCE_REFRESH=1
        shift
        ;;
      --compose-arg)
        [[ $# -lt 2 ]] && die "--compose-arg requires a value"
        DOCKER_COMPOSE_ARGS+=("$2")
        shift 2
        ;;
      --wiki-backup)
        WIKI_BACKUP=1
        shift
        ;;
      --wiki-backup-url)
        [[ $# -lt 2 ]] && die "--wiki-backup-url requires a value"
        WIKI_BACKUP_URL="$2"
        shift 2
        ;;
      --list)
        print_list
        exit 0
        ;;
      -h|--help)
        print_usage
        exit 0
        ;;
      --)
        shift
        args+=("$@")
        break
        ;;
      -* )
        die "Unknown option: $1"
        ;;
      * )
        args+=("$1")
        shift
        ;;
    esac
  done

  if [[ ${#args[@]} -eq 0 ]]; then
    print_usage
    exit 0
  fi

  ensure_prerequisites
  resolve_targets "${args[@]}"
  warn_port_collisions

  mkdir -p "$CACHE_DIR"

  for dataset in "${TARGETS[@]}"; do
    local url
    url="$(dataset_url "$dataset")"
    local compose_file
    compose_file="$(cache_compose_file "$dataset" "$url")"
    local override_file=""
    if [[ $WIKI_BACKUP -eq 1 && ( "$dataset" == "wiki" || "$dataset" == "wiki-gpu" ) ]]; then
      override_file="$(prepare_wiki_backup_override "$dataset")"
    fi
    run_compose "$dataset" "$compose_file" "$override_file"
  done
}

main "$@"
