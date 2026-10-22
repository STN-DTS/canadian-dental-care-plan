###############################################################################
# Main terraform configuration (providers, backend, etc)
# For all Terraform configuration settings, see: https://www.terraform.io/docs/configuration/terraform.html
###############################################################################

terraform {
  required_version = ">= 1.7.0, < 2.0.0"

  required_providers {
    azuread = {
      # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs
      source  = "hashicorp/azuread"
      version = "~> 3.0"
    }

    azurerm = {
      # see: https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs
      source  = "hashicorp/azurerm"
      version = "~> 5.0"
    }
  }
}

# #############################################################################
# Azure Active Directory App Registration configuration...
#
# Note that in the AzureAD terraform provider, an app registration is actually an `azuread_application` resource
# see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/application
# #############################################################################

data "azuread_users" "owners" {
  # Application registraion owners have the ability to view and edit an application registration.
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/data-sources/users

  user_principal_names = var.application_owners
}

data "azuread_users" "role_assignments" {
  # Creates a [{app_role_id → azuread_users}] data structure for mapping roles to users.
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/data-sources/users

  for_each = { for application_app_role in var.application_app_roles : application_app_role.id => application_app_role.members }

  user_principal_names = each.value
}


resource "azuread_application" "main" {
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/application

  display_name                   = var.application_display_name
  fallback_public_client_enabled = var.application_public
  identifier_uris                = var.application_identifier_uris
  logo_image                     = filebase64("assets/logo.png")
  owners                         = data.azuread_users.owners.object_ids

  api {
    mapped_claims_enabled          = true
    requested_access_token_version = 2

    dynamic "oauth2_permission_scope" {
      for_each = var.application_oauth2_permission_scopes

      content {
        id                         = oauth2_permission_scope.value.id
        admin_consent_description  = oauth2_permission_scope.value.admin_consent_description
        admin_consent_display_name = oauth2_permission_scope.value.admin_consent_display_name
        user_consent_description   = oauth2_permission_scope.value.user_consent_description
        user_consent_display_name  = oauth2_permission_scope.value.user_consent_display_name
        value                      = oauth2_permission_scope.value.value
      }
    }
  }

  dynamic "app_role" {
    for_each = var.application_app_roles

    content {
      allowed_member_types = app_role.value.allowed_member_types
      description          = app_role.value.description
      display_name         = app_role.value.display_name
      id                   = app_role.value.id
      value                = app_role.value.value
    }
  }

  web {
    redirect_uris = var.application_web_redirect_uris

    implicit_grant {
      access_token_issuance_enabled = var.application_web_implicit_grants_access_token_issuance_enabled
      id_token_issuance_enabled     = var.application_web_implicit_grants_id_token_issuance_enabled
    }
  }
}

resource "azuread_application_password" "main" {
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/application_password

  for_each = { for application_password in var.application_passwords : application_password => application_password }

  application_id = azuread_application.main.id
  display_name   = each.value
  end_date       = "2100-01-01T00:00:00Z"
}

resource "azuread_service_principal" "main" {
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/service_principal

  client_id = azuread_application.main.client_id
  owners    = azuread_application.main.owners
}

resource "azuread_app_role_assignment" "main" {
  # see: https://registry.terraform.io/providers/hashicorp/azuread/latest/docs/resources/app_role_assignment

  for_each = {
    # Creates a collection of azuread_app_role_assignment resources...
    # Each key follows the format: azuread_app_role_assignment.main[${app_role_id}/${principal_object_id}]
    for role_assignment in flatten([
      for app_role_id, role_assignments in data.azuread_users.role_assignments : [
        for principal_object_id in role_assignments.object_ids : {
          app_role_id         = app_role_id
          principal_object_id = principal_object_id
        }
      ]
    ]) : "${role_assignment.app_role_id}/${role_assignment.principal_object_id}" => role_assignment
  }

  app_role_id         = each.value.app_role_id
  principal_object_id = each.value.principal_object_id
  resource_object_id  = azuread_service_principal.main.object_id
}
