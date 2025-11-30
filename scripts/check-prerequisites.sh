#!/bin/bash

# Check prerequisites for E2E testing environment
# Run this before start-all.sh to verify your setup

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASSED=0
FAILED=0
WARNINGS=0

check_passed() {
  echo -e "${GREEN}✓${NC} $1"
  PASSED=$((PASSED + 1))
}

check_failed() {
  echo -e "${RED}✗${NC} $1"
  FAILED=$((FAILED + 1))
}

check_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
  WARNINGS=$((WARNINGS + 1))
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}Wundr E2E Prerequisites Check${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Node.js
echo -e "${BLUE}Checking Node.js...${NC}"
if command -v node &> /dev/null; then
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -ge 18 ]; then
    check_passed "Node.js $(node -v)"
  else
    check_failed "Node.js version must be >= 18 (found: $(node -v))"
  fi
else
  check_failed "Node.js is not installed"
fi

# pnpm
echo -e "${BLUE}Checking pnpm...${NC}"
if command -v pnpm &> /dev/null; then
  check_passed "pnpm $(pnpm -v)"
else
  check_failed "pnpm is not installed - run: npm install -g pnpm"
fi

# Docker
echo -e "${BLUE}Checking Docker...${NC}"
if command -v docker &> /dev/null; then
  if docker info &> /dev/null; then
    check_passed "Docker is running ($(docker --version))"
  else
    check_warning "Docker is installed but not running"
  fi
else
  check_warning "Docker is not installed (optional, but recommended)"
fi

# Redis
echo -e "${BLUE}Checking Redis...${NC}"
if command -v redis-cli &> /dev/null; then
  if redis-cli ping &> /dev/null 2>&1; then
    check_passed "Redis is running"
  else
    check_warning "Redis is installed but not running"
  fi
else
  if command -v docker &> /dev/null && docker info &> /dev/null; then
    check_warning "Redis not installed locally (will use Docker)"
  else
    check_warning "Redis not available (install locally or enable Docker)"
  fi
fi

# PostgreSQL
echo -e "${BLUE}Checking PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
  DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/neolith}"
  if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null 2>&1; then
    check_passed "PostgreSQL is running"
  else
    check_warning "PostgreSQL is installed but not running or not accessible"
  fi
else
  if command -v docker &> /dev/null && docker info &> /dev/null; then
    check_warning "PostgreSQL not installed locally (will use Docker)"
  else
    check_warning "PostgreSQL not available (install locally or enable Docker)"
  fi
fi

# Port availability
echo -e "${BLUE}Checking ports...${NC}"
if lsof -ti:8787 &> /dev/null; then
  check_failed "Port 8787 is in use (required for daemon)"
else
  check_passed "Port 8787 is available"
fi

if lsof -ti:3000 &> /dev/null; then
  check_failed "Port 3000 is in use (required for web app)"
else
  check_passed "Port 3000 is available"
fi

if lsof -ti:6379 &> /dev/null; then
  check_passed "Port 6379 is in use (Redis)"
else
  check_warning "Port 6379 is available (Redis not running)"
fi

if lsof -ti:5432 &> /dev/null; then
  check_passed "Port 5432 is in use (PostgreSQL)"
else
  check_warning "Port 5432 is available (PostgreSQL not running)"
fi

# Dependencies
echo -e "${BLUE}Checking dependencies...${NC}"
if [ -d "node_modules" ]; then
  check_passed "node_modules exists"
else
  check_warning "node_modules not found - run: pnpm install"
fi

if [ -f "pnpm-lock.yaml" ]; then
  check_passed "pnpm-lock.yaml exists"
else
  check_warning "pnpm-lock.yaml not found"
fi

# Scripts
echo -e "${BLUE}Checking scripts...${NC}"
if [ -x "scripts/start-all.sh" ]; then
  check_passed "start-all.sh is executable"
else
  check_failed "start-all.sh is not executable - run: chmod +x scripts/start-all.sh"
fi

if [ -x "scripts/stop-all.sh" ]; then
  check_passed "stop-all.sh is executable"
else
  check_failed "stop-all.sh is not executable - run: chmod +x scripts/stop-all.sh"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed:${NC} $PASSED | ${RED}Failed:${NC} $FAILED | ${YELLOW}Warnings:${NC} $WARNINGS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ Ready to run: pnpm run start:all${NC}"
  exit 0
else
  echo -e "${RED}✗ Please fix the failed checks before running start-all.sh${NC}"
  exit 1
fi
