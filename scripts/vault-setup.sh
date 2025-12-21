#!/bin/bash
# =============================================================================
# Vault Local Setup Script for Configit Testing
# =============================================================================
# This script sets up a complete local testing environment:
#   - Vault with KV v2, Database, AppRole, and GCP auth
#   - PostgreSQL for dynamic secrets with TTL
#   - GCP project & service account for GCP IAM auth testing
#
# Prerequisites:
#   - Docker running
#   - gcloud CLI installed and authenticated (for GCP auth testing)
#
# Usage:
#   ./scripts/vault-setup.sh              # Full setup including GCP
#   ./scripts/vault-setup.sh --skip-gcp   # Skip GCP setup
#   ./scripts/vault-setup.sh --cleanup    # Cleanup GCP project only
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
VAULT_ADDR="http://127.0.0.1:8200"
VAULT_TOKEN="configit-dev-token"
VAULT_CONTAINER="configit-vault"
PG_CONTAINER="configit-postgres"
PG_HOST="postgres"
PG_USER="vault_admin"
PG_PASS="vault_admin_password"
PG_DB="configit_test"

# GCP Configuration
GCP_PROJECT_PREFIX="configit-vault-test"
GCP_SA_NAME="configit-vault-auth"
GCP_KEY_FILE="./secrets/gcp-sa-key.json"
GCP_PROJECT_FILE="./.gcp-test-project"

export VAULT_ADDR
export VAULT_TOKEN

# Parse arguments
SKIP_GCP=false
CLEANUP_ONLY=false
for arg in "$@"; do
  case $arg in
    --skip-gcp)
      SKIP_GCP=true
      ;;
    --cleanup)
      CLEANUP_ONLY=true
      ;;
  esac
done

# Function to run vault commands
vault_cmd() {
  if command -v vault &> /dev/null; then
    vault "$@"
  else
    docker exec -e VAULT_ADDR=$VAULT_ADDR -e VAULT_TOKEN=$VAULT_TOKEN $VAULT_CONTAINER vault "$@"
  fi
}

# Function to cleanup GCP project
cleanup_gcp() {
  echo -e "\n${YELLOW}Cleaning up GCP resources...${NC}"
  
  if [ -f "$GCP_PROJECT_FILE" ]; then
    GCP_PROJECT=$(cat "$GCP_PROJECT_FILE")
    echo -e "  Deleting GCP project: ${GCP_PROJECT}"
    
    if gcloud projects describe "$GCP_PROJECT" &> /dev/null; then
      gcloud projects delete "$GCP_PROJECT" --quiet 2>/dev/null || true
      echo -e "${GREEN}✓ GCP project deleted${NC}"
    else
      echo -e "${YELLOW}  Project already deleted or doesn't exist${NC}"
    fi
    
    rm -f "$GCP_PROJECT_FILE"
    rm -f "$GCP_KEY_FILE"
  else
    echo -e "${YELLOW}  No GCP project file found - nothing to cleanup${NC}"
  fi
}

# If cleanup only, do that and exit
if [ "$CLEANUP_ONLY" = true ]; then
  cleanup_gcp
  echo -e "\n${GREEN}✓ Cleanup complete${NC}"
  exit 0
fi

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}  Configit Vault Local Setup${NC}"
echo -e "${BLUE}=============================================${NC}"

# Step 1: Start containers
echo -e "\n${YELLOW}Step 1: Starting Vault & PostgreSQL containers...${NC}"
if docker ps --format '{{.Names}}' | grep -q "^${VAULT_CONTAINER}$"; then
  echo -e "${GREEN}✓ Vault container already running${NC}"
else
  docker compose -f docker-compose.vault.yml up -d
  echo -e "${GREEN}✓ Containers started${NC}"
  echo -e "${YELLOW}  Waiting for services to be ready...${NC}"
  sleep 5
fi

# Wait for Vault to be healthy
echo -e "\n${YELLOW}Step 2: Waiting for Vault to be ready...${NC}"
for i in {1..30}; do
  if vault_cmd status > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Vault is running and unsealed${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ Vault did not start in time${NC}"
    exit 1
  fi
  sleep 1
done

# Wait for PostgreSQL to be healthy
echo -e "\n${YELLOW}Step 3: Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
  if docker exec $PG_CONTAINER pg_isready -U $PG_USER -d $PG_DB > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
    break
  fi
  if [ $i -eq 30 ]; then
    echo -e "${RED}✗ PostgreSQL did not start in time${NC}"
    exit 1
  fi
  sleep 1
done

# Step 4: Create KV v2 secrets
echo -e "\n${YELLOW}Step 4: Creating KV v2 test secrets...${NC}"

vault_cmd kv put secret/configit/api \
  api_key="test-api-key-123" \
  api_secret="test-api-secret-xyz" > /dev/null
echo -e "${GREEN}✓ Created secret/configit/api${NC}"

vault_cmd kv put secret/configit/database \
  host="localhost" \
  port="5432" \
  username="testuser" \
  password="testpassword" > /dev/null
echo -e "${GREEN}✓ Created secret/configit/database${NC}"

vault_cmd kv put secret/configit/features \
  enable_beta="true" \
  max_connections="100" > /dev/null
echo -e "${GREEN}✓ Created secret/configit/features${NC}"

# Step 5: Setup database secrets engine
echo -e "\n${YELLOW}Step 5: Setting up database secrets engine...${NC}"

vault_cmd secrets enable database 2>/dev/null || true

vault_cmd write database/config/configit-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="configit-readonly,configit-readwrite" \
  connection_url="postgresql://{{username}}:{{password}}@${PG_HOST}:5432/${PG_DB}?sslmode=disable" \
  username="$PG_USER" \
  password="$PG_PASS" > /dev/null
echo -e "${GREEN}✓ Configured PostgreSQL connection${NC}"

vault_cmd write database/roles/configit-readonly \
  db_name=configit-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="60s" \
  max_ttl="120s" > /dev/null
echo -e "${GREEN}✓ Created 'configit-readonly' role (TTL: 60s)${NC}"

# Step 6: Setup AppRole auth
echo -e "\n${YELLOW}Step 6: Setting up AppRole authentication...${NC}"

vault_cmd auth enable approle 2>/dev/null || true

vault_cmd policy write configit-policy - > /dev/null <<EOF
path "secret/data/configit/*" {
  capabilities = ["read", "list"]
}
path "database/creds/*" {
  capabilities = ["read"]
}
path "sys/leases/renew" {
  capabilities = ["update"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
EOF
echo -e "${GREEN}✓ Created configit-policy${NC}"

vault_cmd write auth/approle/role/configit-role \
  token_policies="configit-policy" \
  token_ttl="1h" \
  token_max_ttl="4h" > /dev/null
echo -e "${GREEN}✓ Created AppRole 'configit-role'${NC}"

ROLE_ID=$(vault_cmd read -field=role_id auth/approle/role/configit-role/role-id)
SECRET_ID=$(vault_cmd write -field=secret_id -f auth/approle/role/configit-role/secret-id)

# Step 7: Setup GCP auth (if not skipped)
if [ "$SKIP_GCP" = false ]; then
  echo -e "\n${YELLOW}Step 7: Setting up GCP IAM authentication...${NC}"
  
  # Check if gcloud is available
  if ! command -v gcloud &> /dev/null; then
    echo -e "${YELLOW}  gcloud CLI not found - skipping GCP setup${NC}"
    echo -e "${YELLOW}  Install with: brew install google-cloud-sdk${NC}"
    SKIP_GCP=true
  fi
fi

if [ "$SKIP_GCP" = false ]; then
  # Check if user is logged in
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null | grep -q "@"; then
    echo -e "${YELLOW}  Not logged into gcloud - skipping GCP setup${NC}"
    echo -e "${YELLOW}  Login with: gcloud auth login${NC}"
    SKIP_GCP=true
  fi
fi

if [ "$SKIP_GCP" = false ]; then
  # Generate unique project ID
  TIMESTAMP=$(date +%s)
  GCP_PROJECT="${GCP_PROJECT_PREFIX}-${TIMESTAMP: -6}"
  
  echo -e "  Creating GCP project: ${CYAN}${GCP_PROJECT}${NC}"
  
  # Try to create project
  if gcloud projects create "$GCP_PROJECT" --name="Configit Vault Test" 2>/dev/null; then
    echo -e "${GREEN}✓ GCP project created${NC}"
    
    # Save project ID for cleanup
    echo "$GCP_PROJECT" > "$GCP_PROJECT_FILE"
    
    # Set as current project
    gcloud config set project "$GCP_PROJECT" --quiet
    
    # Enable required APIs
    echo -e "  Enabling IAM APIs..."
    gcloud services enable iam.googleapis.com iamcredentials.googleapis.com --quiet 2>/dev/null
    echo -e "${GREEN}✓ APIs enabled${NC}"
    
    # Create service account
    SA_EMAIL="${GCP_SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"
    gcloud iam service-accounts create "$GCP_SA_NAME" \
      --display-name="Configit Vault Auth" --quiet 2>/dev/null
    echo -e "${GREEN}✓ Service account created${NC}"
    
    # Grant token creator permission
    gcloud projects add-iam-policy-binding "$GCP_PROJECT" \
      --member="serviceAccount:${SA_EMAIL}" \
      --role="roles/iam.serviceAccountTokenCreator" --quiet > /dev/null 2>&1
    echo -e "${GREEN}✓ IAM permissions granted${NC}"
    
    # Create key file
    mkdir -p secrets
    gcloud iam service-accounts keys create "$GCP_KEY_FILE" \
      --iam-account="$SA_EMAIL" --quiet 2>/dev/null
    echo -e "${GREEN}✓ Key file created${NC}"
    
    # Wait for IAM propagation
    echo -e "  Waiting for IAM propagation (15s)..."
    sleep 15
    
    # Configure Vault GCP auth
    vault_cmd auth enable gcp 2>/dev/null || true
    
    # Copy key to Vault container
    docker cp "$GCP_KEY_FILE" $VAULT_CONTAINER:/tmp/gcp-sa-key.json
    
    # Read key content and configure GCP auth
    GCP_KEY_CONTENT=$(cat "$GCP_KEY_FILE" | jq -c .)
    docker exec -e VAULT_ADDR=$VAULT_ADDR -e VAULT_TOKEN=$VAULT_TOKEN $VAULT_CONTAINER \
      vault write auth/gcp/config credentials="$GCP_KEY_CONTENT" > /dev/null
    echo -e "${GREEN}✓ Vault GCP auth configured${NC}"
    
    # Create GCP role with SHORT TTL (10s) for testing token refresh
    vault_cmd write auth/gcp/role/configit-gcp-role \
      type="iam" \
      policies="configit-policy" \
      bound_service_accounts="$SA_EMAIL" \
      token_ttl="10s" \
      token_max_ttl="30s" > /dev/null
    echo -e "${GREEN}✓ GCP role created (TTL: 10s for testing)${NC}"
    
    # Also create a longer TTL role for normal use
    vault_cmd write auth/gcp/role/configit-gcp-role-long \
      type="iam" \
      policies="configit-policy" \
      bound_service_accounts="$SA_EMAIL" \
      token_ttl="1h" \
      token_max_ttl="4h" > /dev/null
    echo -e "${GREEN}✓ GCP role (long TTL) created${NC}"
    
    GCP_SETUP_SUCCESS=true
  else
    echo -e "${YELLOW}  Could not create GCP project (may need permissions)${NC}"
    echo -e "${YELLOW}  GCP auth tests will be skipped${NC}"
    GCP_SETUP_SUCCESS=false
  fi
else
  GCP_SETUP_SUCCESS=false
fi

# Step 8: Print summary
echo -e "\n${BLUE}=============================================${NC}"
echo -e "${GREEN}  ✓ Vault Setup Complete!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${YELLOW}Services:${NC}"
echo -e "  Vault:      $VAULT_ADDR (UI: http://localhost:8200/ui)"
echo -e "  PostgreSQL: localhost:5433 (user: $PG_USER, db: $PG_DB)"
echo ""
echo -e "${YELLOW}Authentication Methods:${NC}"
echo -e "  ${BLUE}1. Token:${NC} VAULT_TOKEN=$VAULT_TOKEN"
echo -e "  ${BLUE}2. AppRole:${NC}"
echo -e "     VAULT_ROLE_ID=$ROLE_ID"
echo -e "     VAULT_SECRET_ID=$SECRET_ID"
if [ "$GCP_SETUP_SUCCESS" = true ]; then
  echo -e "  ${BLUE}3. GCP IAM:${NC}"
  echo -e "     Project: $GCP_PROJECT"
  echo -e "     Key: $GCP_KEY_FILE"
  echo -e "     Role (short TTL): configit-gcp-role (10s TTL)"
  echo -e "     Role (long TTL): configit-gcp-role-long (1h TTL)"
fi
echo ""
echo -e "${YELLOW}Test Secrets:${NC}"
echo -e "  KV v2 (static):  secret/configit/*"
echo -e "  Database (TTL):  database/creds/configit-readonly (60s)"
echo ""
echo -e "${YELLOW}Run Tests:${NC}"
echo -e "  npx ts-node scripts/test-vault-comprehensive.ts"
echo -e "  npx ts-node scripts/test-vault-dynamic.ts"
if [ "$GCP_SETUP_SUCCESS" = true ]; then
  echo -e "  npx ts-node scripts/test-vault-gcp-ttl.ts"
fi
echo ""
if [ "$GCP_SETUP_SUCCESS" = true ]; then
  echo -e "${YELLOW}Cleanup GCP (when done):${NC}"
  echo -e "  ./scripts/vault-setup.sh --cleanup"
fi
echo -e "${BLUE}=============================================${NC}"

# Create .env.vault.local
cat > .env.vault.local <<EOF
# Vault Local Development Configuration
# Generated by vault-setup.sh - DO NOT COMMIT

LOCAL_VAULT_ADDR=$VAULT_ADDR
LOCAL_VAULT_TOKEN=$VAULT_TOKEN

# AppRole
VAULT_ROLE_ID=$ROLE_ID
VAULT_SECRET_ID=$SECRET_ID

# GCP (if configured)
GCP_PROJECT=${GCP_PROJECT:-""}
GCP_KEY_FILE=$GCP_KEY_FILE
EOF

echo -e "${GREEN}✓ Created .env.vault.local${NC}"
