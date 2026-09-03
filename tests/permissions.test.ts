import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCompany,
  canActAsAdmin,
  canActAsIt,
  canCreateLinks,
  canEditBackup,
  canEditLinks,
  canManageCompanies,
  canManageUsers,
  canManageUserRole,
  canManageMobileAgents,
  canViewIncidents,
  canViewLinks,
  canViewMobileAgents,
  canRunCheck,
  canViewKpi,
  canViewReport,
  isAppRole,
} from "../src/lib/permissions";

test("ADMIN has unrestricted management access", () => {
  assert.equal(canManageUsers("ADMIN"), true);
  assert.equal(canManageCompanies("ADMIN"), true);
  assert.equal(canManageMobileAgents("ADMIN"), true);
  assert.equal(canCreateLinks("ADMIN"), true);
  assert.equal(canActAsAdmin("ADMIN"), true);
  assert.equal(canActAsIt("ADMIN"), true);
  assert.equal(canRunCheck("ADMIN"), true);
});

test("ADMIN_LEAD is the assistant admin and cannot manage users", () => {
  assert.equal(canEditLinks("ADMIN_LEAD"), true);
  assert.equal(canEditBackup("ADMIN_LEAD"), true);
  assert.equal(canActAsAdmin("ADMIN_LEAD"), true);
  assert.equal(canViewKpi("ADMIN_LEAD"), true);
  assert.equal(canManageUsers("ADMIN_LEAD"), false);
  assert.equal(canManageUserRole("ADMIN_LEAD", "IT"), false);
  assert.equal(canManageUserRole("ADMIN_LEAD", "ADMIN"), false);
  assert.equal(canManageCompanies("ADMIN_LEAD"), false);
  assert.equal(canManageMobileAgents("ADMIN_LEAD"), false);
  assert.equal(canViewReport("ADMIN_LEAD"), false);
  assert.equal(canAccessCompany("ADMIN_LEAD", [], "company-b"), true);
});

test("legacy ADMIN_COMPANY keeps assistant access but is not assignable", () => {
  assert.equal(canEditLinks("ADMIN_COMPANY"), true);
  assert.equal(canCreateLinks("ADMIN_COMPANY"), true);
  assert.equal(canEditBackup("ADMIN_COMPANY"), true);
  assert.equal(canActAsAdmin("ADMIN_COMPANY"), true);
  assert.equal(canViewKpi("ADMIN_COMPANY"), true);
  assert.equal(canManageUsers("ADMIN_COMPANY"), false);
  assert.equal(canManageMobileAgents("ADMIN_COMPANY"), false);
  assert.equal(canAccessCompany("ADMIN_COMPANY", ["company-a"], "company-a"), true);
  assert.equal(canAccessCompany("ADMIN_COMPANY", ["company-a"], "company-b"), true);
  assert.equal(isAppRole("ADMIN_COMPANY"), false);
});

test("IT can only perform IT incident work and edit backup links", () => {
  assert.equal(canEditBackup("IT"), true);
  assert.equal(canActAsIt("IT"), true);
  assert.equal(canEditLinks("IT"), false);
  assert.equal(canActAsAdmin("IT"), false);
  assert.equal(canViewKpi("IT"), false);
  assert.equal(canManageMobileAgents("IT"), false);
});

test("MANAGEMENT is read-only for dashboard, report and KPI", () => {
  assert.equal(canViewReport("MANAGEMENT"), true);
  assert.equal(canViewKpi("MANAGEMENT"), true);
  assert.equal(canViewLinks("MANAGEMENT"), true);
  assert.equal(canViewIncidents("MANAGEMENT"), true);
  assert.equal(canEditLinks("MANAGEMENT"), false);
  assert.equal(canEditBackup("MANAGEMENT"), false);
  assert.equal(canActAsAdmin("MANAGEMENT"), false);
  assert.equal(canActAsIt("MANAGEMENT"), false);
  assert.equal(canRunCheck("MANAGEMENT"), false);
  assert.equal(canManageMobileAgents("MANAGEMENT"), false);
});

test("SITE_STAFF can only view the mobile agent page", () => {
  assert.equal(canViewMobileAgents("SITE_STAFF"), true);
  assert.equal(canManageMobileAgents("SITE_STAFF"), false);
  assert.equal(canViewReport("SITE_STAFF"), false);
  assert.equal(canViewKpi("SITE_STAFF"), false);
  assert.equal(canEditLinks("SITE_STAFF"), false);
  assert.equal(canEditBackup("SITE_STAFF"), false);
  assert.equal(canRunCheck("SITE_STAFF"), false);
});
