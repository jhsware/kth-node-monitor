'use strict'

/**
 * System controller support functions for /monitor
 */
const { safeGet } = require('safe-utils')
const registry = require('component-registry').globalRegistry
const { createUtility } = require('component-registry')
const Promise = require('bluebird')

const IHealthCheck = require('./interfaces').IHealthCheck

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-api',

  status: function (endpoint) {
    return endpoint.client.getAsync(safeGet(() => endpoint.config.proxyBasePath) + '/_monitor')
      .then((data) => {
        return Promise.resolve({ key: endpoint.key, statusCode: data.statusCode })
      })
      .catch(() => {
        return Promise.resolve({ key: endpoint.key, statusCode: 503 })
      })
  }
}).registerWith(registry)

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-ldap',

  status: function (ldap) {
    if (ldap.isOk()) {
      return Promise.resolve({ key: 'ldap', statusCode: 200 })
    } else {
      return Promise.resolve({ key: 'ldap', statusCode: 503 })
    }
  }
}).registerWith(registry)

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-mongodb',

  status: function (db) {
    if (db.isOk()) {
      return Promise.resolve({ key: 'mongodb', statusCode: 200 })
    } else {
      return Promise.resolve({ key: 'mongodb', statusCode: 503 })
    }
  }
}).registerWith(registry)

function _createApiStatusObj (key, statusCode, required) {
  var message
  if (statusCode === 200) {
    message = `API_STATUS: ${key} is OK` + (required ? ' (required)' : '')
  } else {
    message = `API_STATUS: ${key} responded with status ${statusCode}`
    message += (required ? ' (WARNING! This API is required to be ok for system to report ok)' : ' (This API is NOT required to be ok for system to report ok)')
  }

  return {
    statusCode: statusCode,
    required: required,
    message: message
  }
}

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-system-check',

  status: function (localSystems, subSystems, systemsConfig) {
    // Handle if we don't have subsystems
    subSystems = subSystems || [Promise.resolve(undefined)]

    // Consolidate all results
    return Promise.all(subSystems)
      .then((results) => {
        const outp = {}
        results.forEach((status) => {
          outp[status.key] = status
        })
        return Promise.resolve(outp)
      })
      .then((subSystems) => {
        return localSystems.then((result) => Promise.resolve({localSystems: result, subSystems: subSystems}))
      })
      .then((result) => {
        const subSystems = result.subSystems
        const localSystems = result.localSystems

        var systemOk = (localSystems.statusCode === 200)
        var outpSubSystems = {}
        if (systemsConfig === undefined) {
            Object.keys(subSystems).forEach((apiKey) => {
              outpSubSystems[apiKey] = _createApiStatusObj(apiKey, subSystems[apiKey].statusCode)    
            })
        } else {
          Object.keys(systemsConfig).forEach((apiKey) => {
            systemOk = systemOk && (systemsConfig[apiKey].required ? subSystems[apiKey].statusCode === 200 : true)
            outpSubSystems[apiKey] = _createApiStatusObj(apiKey, subSystems[apiKey].statusCode, systemsConfig[apiKey].required)
          })
        }

        return Promise.resolve({
          statusCode: (systemOk ? 200 : 503),
          message: (systemOk ? 'OK' : 'ERROR'),
          subSystems: outpSubSystems
        })
      })
  },

  renderJSON: function (systemHealth) {
    return systemHealth
  },

  renderText: function (systemHealth) {
    var outp = `APPLICATION_STATUS: ${systemHealth.message}` + '\n'
    outp += Object.keys(systemHealth.subSystems).map((apiKey) => {
      return systemHealth.subSystems[apiKey].message
    }).join('\n')
    return outp
  }

}).registerWith(registry)
