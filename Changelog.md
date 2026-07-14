# Changelog

All notable changes to FinFlow Enterprise will be documented in this file.

---

# Phase 2.1 - Departments
**Date:** 2026-07-14

## Added

### Backend
- Department Repository
- Department Controller
- Department Routes
- Department CRUD APIs
- Workspace-scoped department queries
- Default department seeding trigger
- Soft delete support
- Duplicate department validation

### Database
- Migration 003_phase2_1_departments.sql
- Automatic creation of 9 default departments
- Backfilled existing workspaces

### Frontend
- Departments page
- Department Context
- Department Service
- Department navigation
- Workspace Switcher improvements
- Create Workspace modal

### Security
- RBAC permissions
- departments.read
- departments.manage

### Verified
- Department CRUD
- Multi-workspace isolation
- Automatic department seeding
- Workspace creation
- Navigation
- Frontend integration

### Fixed
- Double `/api/api` bug in workspaceService
- Double `/api/api` bug in companyService
- Double `/api/api` bug in PermissionContext
- departmentController export issue

### Known Issues
- billService still references missing `bills` table
- `department_id` not yet integrated into Transactions
- `department_id` not yet integrated into Budgets
- `department_id` not yet integrated into Categories

### Status
✅ Phase 2.1 Complete
