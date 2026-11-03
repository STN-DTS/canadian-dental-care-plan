# Outage notes 2026-10-28

- 14:02 deploy of benefits-api 4.12.0 started
- 14:09 error rate rose to 18% on POST /applications
- 14:11 on-call paged by BenefitsApiErrorRate
- 14:20 rollback to 4.11.3 started
- 14:26 error rate back under 0.5%
- Cause: new address validator rejected postal codes with lowercase letters
