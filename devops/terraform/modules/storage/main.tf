# ==============================================================================
# CollabPulse - Terraform Module: Azure Blob Storage (Secure Multi-Tenant Files)
# ==============================================================================

resource "azurerm_storage_account" "storage" {
  name                     = "stcollab${var.environment}${var.unique_suffix}"
  resource_group_name      = var.resource_group_name
  location                 = var.location
  account_tier             = "Standard"
  account_replication_type = var.replication_type
  min_tls_version          = "TLS1_2"

  # Section 50: Security Hardening
  enable_https_traffic_only       = true
  allow_nested_items_to_be_public = false # STRICTLY NO PUBLIC BLOBS
  shared_access_key_enabled       = true

  blob_properties {
    versioning_enabled       = true
    change_feed_enabled      = true

    delete_retention_policy {
      days = 14
    }

    container_delete_retention_policy {
      days = 14
    }
  }

  tags = var.tags
}

# Private container for workspace documents and attachments
resource "azurerm_storage_container" "workspaces_container" {
  name                  = "collabpulse-files"
  storage_account_name  = azurerm_storage_account.storage.name
  container_access_type = "private"
}

# Lifecycle Management: Clean temp files and tier cold data
resource "azurerm_storage_management_policy" "lifecycle" {
  storage_account_id = azurerm_storage_account.storage.id

  rule {
    name    = "clean-temp-and-tier-old-files"
    enabled = true
    filters {
      prefix_match = ["collabpulse-files/temp/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        delete_after_days_since_modification_greater_than = 7
      }
    }
  }

  rule {
    name    = "tier-historical-files-to-cool"
    enabled = true
    filters {
      prefix_match = ["collabpulse-files/workspaces/"]
      blob_types   = ["blockBlob"]
    }
    actions {
      base_blob {
        tier_to_cool_after_days_since_modification_greater_than = 90
        tier_to_archive_after_days_since_modification_greater_than = 365
      }
    }
  }
}
