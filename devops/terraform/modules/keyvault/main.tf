# ==============================================================================
# CollabPulse - Terraform Module: Azure Key Vault (Secrets Management)
# ==============================================================================

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "kv" {
  name                        = "kv-collabpulse-${var.environment}"
  location                    = var.location
  resource_group_name         = var.resource_group_name
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  sku_name                    = "standard"
  soft_delete_retention_days  = 90
  purge_protection_enabled    = true
  enable_rbac_authorization   = true

  network_acls {
    bypass         = "AzureServices"
    default_action = "Deny"
  }

  tags = var.tags
}

output "key_vault_id" { value = azurerm_key_vault.kv.id }
output "key_vault_uri" { value = azurerm_key_vault.kv.vault_uri }
