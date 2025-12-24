#!/usr/bin/env python3
"""
Setup comprehensive test data for Weaviate Studio
This script creates multiple collections with nested properties and cross-references
"""

import subprocess
import sys
import time

def run_script(script_name, description):
    """Run a Python script and handle errors"""
    print(f"\n{'='*60}")
    print(f"Running {description}")
    print(f"{'='*60}")
    
    try:
        result = subprocess.run([sys.executable, script_name], 
                              capture_output=False, 
                              text=True, 
                              cwd='.')
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully!")
            return True
        else:
            print(f"❌ {description} failed with return code {result.returncode}")
            return False
            
    except Exception as e:
        print(f"❌ Error running {description}: {e}")
        return False

def main():
    print("🚀 Setting up comprehensive test data for Weaviate Studio")
    print("This will create multiple collections with:")
    print("  • Nested object properties")
    print("  • Cross-references between collections") 
    print("  • Various data types (text, numbers, booleans, dates, geo coordinates)")
    print("  • Real-world GitHub data")
    
    # Keep the original Jeopardy data
    print("\n📚 Keeping existing Jeopardy data...")
    
    # Run advanced collections setup
    success1 = run_script("populate_advanced.py", "Advanced Collections Setup (Books, Authors, Publishers, Reviews)")
    
    if success1:
        print("\n⏳ Waiting 3 seconds before next step...")
        time.sleep(3)
        
        # Run GitHub data setup
        success2 = run_script("populate_github_data.py", "GitHub Data Setup (Users, Repos, Issues)")
        
        if success2:
            print(f"\n🎉 ALL DATA SETUP COMPLETE!")
            print(f"\n📊 Your Weaviate instance now contains:")
            print(f"  • JeopardyQuestion (original data)")
            print(f"  • Author, Publisher, Book, Review (with nested properties & references)")
            print(f"  • GitHubUser, GitHubRepo, GitHubIssue (real GitHub data)")
            
            print(f"\n🧪 Test these features in Weaviate Studio:")
            print(f"  1. Nested Properties:")
            print(f"     - Author.address (street, city, country, zipCode)")
            print(f"     - Book.metadata (language, edition, format, weight)")
            print(f"     - GitHubUser.stats (publicRepos, followers, etc.)")
            print(f"     - GitHubRepo.metrics (stars, forks, watchers)")
            print(f"  2. Cross-References:")
            print(f"     - Book -> Author, Book -> Publisher")
            print(f"     - Review -> Book")
            print(f"     - GitHubRepo -> GitHubUser")
            print(f"     - GitHubIssue -> GitHubRepo, GitHubIssue -> GitHubUser")
            print(f"  3. Various Data Types:")
            print(f"     - Text, Numbers, Booleans, Dates, GeoCoordinates")
            print(f"  4. Complex Queries:")
            print(f"     - Multi-level nested selections")
            print(f"     - Cross-reference traversal")
            print(f"     - Mixed data type filtering")
            
            print(f"\n💡 Sample queries to try:")
            print(f"  • Books with their authors and publishers")
            print(f"  • GitHub repos with owner information and metrics")
            print(f"  • Authors grouped by location with nested address data")
            print(f"  • Issues with reactions and repository context")
            
        else:
            print(f"\n⚠️  GitHub data setup failed, but advanced collections were created successfully")
            print(f"You can still test nested properties and references with the book data")
    else:
        print(f"\n❌ Setup failed. Please check the error messages above.")
        return 1
    
    return 0

if __name__ == "__main__":
    exit(main())