# Update signing custody and recovery runbook

## Key separation

Maintain three independent production key sets:

1. Tauri native updater signing key.
2. Capacitor/Capgo OTA signing and encryption material.
3. Mobile store signing credentials (Android upload key; Apple distribution credentials).

Never commit private keys, key passwords, recovery phrases, keystores, or generated update artifacts. CI receives only the scoped secrets required for its signing job. The public Tauri key is committed only when Phase 1 enables the updater.

## Custody and backup

- The Security Approver owns the inventory and quarterly access review.
- The Release Manager may use CI secrets but must not be the sole recovery custodian.
- Keep two encrypted offline recovery copies in separate controlled locations, each accessible through a documented break-glass procedure.
- Record key identifier, algorithm, creation date, owner roles, storage location, last rotation test, and dependent released app versions in the private key inventory.

## Rotation and compromise response

1. Pause the affected channel and revoke CI access to the exposed secret.
2. Assess whether any signed artifact or store credential may be malicious; notify affected distribution operators.
3. Generate and protect a replacement key in the approved secret-management system.
4. Ship a native release that trusts the replacement public key before retiring a compromised Tauri updater key. Existing clients cannot be updated if their only trusted key is lost or replaced without a bridge release.
5. Verify fresh install, upgrade, invalid-signature rejection, rollback, and recovery from each supported platform.
6. Record the incident, approvals, affected versions, and final disposition in the release audit log.

## Phase 0 completion gate

Production signing keys are intentionally not generated in this repository. Before Phase 1/2 release work, the Security Approver must create them in the approved managed vault, configure the corresponding CI secrets, create the two offline recovery copies, and perform a documented recovery drill.
