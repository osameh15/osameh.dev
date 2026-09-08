# Deploying over FTPS when the certificate chain is not trusted

Shared-hosting environments are not always as clean as modern managed platforms. One deployment issue on this portfolio was an FTPS endpoint whose certificate chain was not trusted by the GitHub Actions runner.

The wrong fix would have been to disable certificate verification and immediately send credentials.

## The safer workflow

The deployment pipeline separates identity verification from authentication:

1. connect to the FTP endpoint without credentials
2. read the server certificate
3. calculate its fingerprint
4. compare it with a fingerprint stored as a GitHub Actions secret
5. only after a match, authenticate and upload

```text
Runner
  ↓
read certificate
  ↓
verify fingerprint
  ↓ match
send FTP credentials
  ↓
FTPS upload
```

## Why this is better than blindly disabling TLS checks

The upload client still needs certificate-chain verification disabled for this particular hosting endpoint, but that happens only after the workflow has independently verified the exact certificate it expects.

A certificate change therefore fails closed: deployment stops before credentials are used.

## Scope the deployment account too

Certificate pinning is only one layer. The FTP account used by CI should be restricted to the deployment directory rather than the whole hosting account.

The production workflow for this portfolio also protects hosting-managed directories such as `.well-known` and `cgi-bin` from mirror deletion.

## Operational trade-off

Pinning introduces maintenance. A legitimate certificate renewal can change the fingerprint, so the new certificate must be verified out of band before the stored fingerprint is updated.

That small operational cost is preferable to turning an authentication warning into a permanent security exception.
