#!/bin/bash
# =============================================================================
# Vault Test Environment Cleanup Script
# =============================================================================
# Cleans up:
#   - GCP test project (and all associated resources)
#   - Local Docker containers (Vault, PostgreSQL)
#   - Generated configuration files
#
# Usage:
#   ./scripts/vault-cleanup.sh              # Full cleanup (GCP + Docker)
#   ./scripts/vault-cleanup.sh --gcp-only   # GCP cleanup only
#   ./scripts/vault-cleanup.sh --docker-only # Docker cleanup only
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Files
GCP_PROJECT_FILE="./.gcp-test-project"
GCP_KEY_FILE="./secrets/gcp-sa-key.json"
ENV_FILE="./.env.vault.local"

# Parse arguments
GCP_ONLY=false
DOCKER_ONLY=false
for arg in "$@"; do
  case $arg in
    --gcp-only)
      GCP_ONLY=true
      ;;
    --docker-only)
      DOCKER_ONLY=true
      ;;
  esac
done

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Configit Vault Test Environment Cleanup${NC}"
echo -e "${BLUE}=============================================${NC}"

# Cleanup GCP
cleanup_gcp() {
  echo -e "\n${YELLOW}Cleaning up GCP resources...${NC}"
  
  if [ -f "$GCP_PROJECT_FILE" ]; then
    GCP_PROJECT=$(cat "$GCP_PROJECT_FILE")
    echo -e "  Found GCP project: ${GCP_PROJECT}"
    
    if command -v gcloud &> /dev/null; then
      if gcloud projects describe "$GCP_PROJECT" &> /dev/null 2>&1; then
        echo -e "  Deleting GCP project..."
        gcloud projects delete "$GCP_PROJECT" --quiet 2>/dev/null || true
        echo -e "${GREEN}✓ GCP project deleted${NC}"
      else
        echo -e "${YELLOW}  Project already deleted or doesn't exist${NC}"
      fi
    else
      echo -e "${YELLOW}  gcloud CLI not found - cannot delete project${NC}"
      echo -e "${YELLOW}  Please delete manually: https://console.cloud.google.com/cloud-resource-manager${NC}"
    fi
    
    rm -f "$GCP_PROJECT_FILE"
    echo -e "${GREEN}✓ Removed project tracking file${NC}"
  else
    echo -e "  No GCP project file found - nothing to cleanup"
  fi
  
  if [ -f "$GCP_KEY_FILE" ]; then
    rm -f "$GCP_KEY_FILE"
    echo -e "${GREEN}✓ Removed GCP key file${NC}"
  fi
}

# Cleanup Docker containers
cleanup_docker() {
  echo -e "\n${YELLOW}Cleaning up Docker containers...${NC}"
  
  if docker ps -a --format '{{.Names}}' | grep -q "configit-vault"; then
    docker compose -f docker-compose.vault.yml down -v 2>/dev/null || \
      docker-compose -f docker-compose.vault.yml down -v 2>/dev/null || true
    echo -e "${GREEN}✓ Docker containers stopped and removed${NC}"
  else
    echo -e "  No Vault containers found"
  fi
}

# Cleanup generated files
cleanup_files() {
  echo -e "\n${YELLOW}Cleaning up generated files...${NC}"
  
  if [ -f "$ENV_FILE" ]; then
    rm -f "$ENV_FILE"
    echo -e "${GREEN}✓ Removed $ENV_FILE${NC}"
  fi
  
  if [ -d "./secrets" ] && [ -z "$(ls -A ./secrets)" ]; then
    rmdir ./secrets
    echo -e "${GREEN}✓ Removed empty secrets directory${NC}"
  fi
}

# Execute cleanup based on flags
if [ "$DOCKER_ONLY" = true ]; then
  cleanup_docker
elif [ "$GCP_ONLY" = true ]; then
  cleanup_gcp
else
  cleanup_gcp
  cleanup_docker
  cleanup_files
fi

echo -e "\n${BLUE}=============================================${NC}"
echo -e "${GREEN}  ✓ Cleanup Complete${NC}"
echo -e "${BLUE}=============================================${NC}\n"

