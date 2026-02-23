#!/usr/bin/env bash
set -euo pipefail

# PencaViva Repository Setup Script
# Run once after creating the GitHub repo: bash scripts/setup-repo.sh

REPO="PencaViva"
OWNER=$(gh api user --jq '.login')

echo "==> Setting up repository: $OWNER/$REPO"

# 1. Create and push develop branch
echo "==> Creating develop branch..."
git checkout -b develop
git push -u origin develop
git checkout main

# 2. Branch protection: main
echo "==> Configuring branch protection for main..."
gh api "repos/$OWNER/$REPO/branches/main/protection" \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / Lint & Format",
      "CI / Type Check",
      "CI / Unit Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

# 3. Branch protection: develop
echo "==> Configuring branch protection for develop..."
gh api "repos/$OWNER/$REPO/branches/develop/protection" \
  --method PUT \
  --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / Lint & Format",
      "CI / Type Check",
      "CI / Unit Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false
}
EOF

# 4. Create GitHub environments
echo "==> Creating GitHub environments..."
gh api "repos/$OWNER/$REPO/environments/development" --method PUT --input - <<EOF
{}
EOF

gh api "repos/$OWNER/$REPO/environments/staging" --method PUT --input - <<EOF
{}
EOF

gh api "repos/$OWNER/$REPO/environments/production" --method PUT --input - <<EOF
{
  "reviewers": [
    {
      "type": "User",
      "id": $(gh api user --jq '.id')
    }
  ]
}
EOF

# 5. Trigger label sync
echo "==> Triggering label sync..."
gh workflow run label-sync.yml

echo ""
echo "==> Setup complete!"
echo "    - Branch protection configured for main and develop"
echo "    - Environments created: development, staging, production"
echo "    - Production requires manual approval from $OWNER"
echo ""
echo "Next steps:"
echo "  1. Add EXPO_TOKEN secret:  gh secret set EXPO_TOKEN"
echo "  2. Add EAS_PROJECT_ID var: gh variable set EAS_PROJECT_ID"
echo "  3. Add Supabase secrets per environment (see CLAUDE.md)"
