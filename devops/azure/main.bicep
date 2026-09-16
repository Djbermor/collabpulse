// =============================================================================
// CollabPulse - Azure Bicep Template (Alternative IaC for Container Apps)
// =============================================================================
@description('Deployment Environment')
@allowed(['dev', 'staging', 'production'])
param environment string = 'production'

@description('Azure Region')
param location string = resourceGroup().location

@description('Database Administrator Login')
param dbAdminLogin string = 'collabpulse_admin'

@secure()
@description('Database Administrator Password')
param dbAdminPassword string

// Log Analytics
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-collabpulse-${environment}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 90
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-collabpulse-${environment}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Container Apps Environment
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'cae-collabpulse-${environment}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

output containerAppEnvId string = containerAppEnv.id
output appInsightsConnectionString string = appInsights.properties.ConnectionString
