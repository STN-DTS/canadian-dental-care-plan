# Infrastructure Agent Guidance

These rules supplement the [root guidance](../AGENTS.md) for files under
`infrastructure/`. Read [README.md](README.md) before changing infrastructure.

- Use Terraform and Terragrunt conventions, not frontend naming rules.
- Trace Terraform module variables and outputs together with the Terragrunt
  configurations that consume them. Preserve environment boundaries.
- Inspect affected modules and shared configuration before changing resource
  names, identifiers, dependencies, or provider settings.
- Keep credentials and state out of source control. Preserve sensitive output
  declarations and do not print client secrets as validation evidence.
- Use native formatting and validation tools for Terraform/Terragrunt files.
  Oxfmt does not replace those checks.
- Planning may require authorized Azure access and the documented VPN/role
  prerequisites. Report checks that could not run; do not claim a verified
  plan without executing it.
- Do not run `apply`, destroy resources, or modify remote state merely to
  validate a task. Infrastructure-changing operations require explicit scope.
