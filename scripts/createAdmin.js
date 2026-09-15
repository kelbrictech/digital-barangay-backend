/**
 * DEPRECATED / RETIRED IN VICO v1.1.0
 *
 * This legacy v1.0 bootstrap command previously created Admin users directly
 * and could promote an existing resident to Admin. That behavior bypasses the
 * v1.1.0 Webmaster credential-governance model and is intentionally disabled.
 *
 * Approved v1.1.0 paths:
 *   - Existing production Admin -> ADM-0001:
 *       EXISTING_ADMIN_EMAIL="..." node scripts/bootstrapExistingAdmin.js
 *   - Seeded Webmaster -> WEB-0001:
 *       WEBMASTER_NAME="..." WEBMASTER_EMAIL="..." WEBMASTER_PASSWORD="..." node scripts/seedWebmaster.js
 *   - Demo Admins ADM-0002..ADM-0005:
 *       use scripts/seedDemoAdmins.js with environment-supplied passwords
 *   - Future Admin credentialing:
 *       use the Webmaster-controlled AdminApplication workflow
 *
 * This file remains only so old deployment notes invoking `npm run seed:admin`
 * fail safely instead of silently creating or promoting privileged accounts.
 */

'use strict';

console.error(
  [
    'seed:admin is retired in VICO v1.1.0.',
    'Direct Admin creation/promotion would bypass Webmaster credential governance.',
    'Use bootstrapExistingAdmin.js for the existing ADM-0001 account,',
    'seedDemoAdmins.js for approved demo accounts, or the Webmaster credentialing workflow.',
    'No database changes were made.',
  ].join('\n')
);

process.exitCode = 1;
