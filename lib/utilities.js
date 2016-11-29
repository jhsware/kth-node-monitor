'use strict'

/**
 * System controller support functions for /monitor
 */
const { safeGet } = require('safe-utils')
const registry = require('component-registry').globalRegistry
const { createUtility } = require('component-registry')
const Promise = require('bluebird')

const IHealthCheck = require('./interfaces').IHealthCheck

function _createApiStatusObj (key, statusCode, required) {
  var message
  if (statusCode === 200) {
    message = `API_STATUS: ${key} is OK` + (required ? ' (required)' : '')
  } else {
    message = `API_STATUS: ${key} responded with status ${statusCode}`
    message += (required ? ' (WARNING! This API is required to be ok for system to report ok)' : ' (This API is NOT required to be ok for system to report ok)')
  }

  return {
    key: key,
    statusCode: statusCode,
    required: required,
    message: message
  }
}

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-api',

  status: function (endpoint, options) {
    // TODO: Add param to tell monitor page not to call other APIs
    // TODO: Set header accepts: application/json 
    return endpoint.client.getAsync(safeGet(() => endpoint.config.proxyBasePath) + '/_monitor')
      .then((data) => {
        return Promise.resolve(_createApiStatusObj(endpoint.key, data.statusCode, options && options.required))
      })
      .catch(() => {
        return Promise.resolve(_createApiStatusObj(endpoint.key, 503, options && options.required))
      })
  }
}).registerWith(registry)

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-ldap',

  status: function (ldap, options) {
    if (ldap.isOk()) {
      return Promise.resolve(_createApiStatusObj('ldap', 200, options && options.required))
    } else {
      return Promise.resolve(_createApiStatusObj('ldap', 503, options && options.required))
    }
  }
}).registerWith(registry)

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-mongodb',

  status: function (db, options) {
    if (db.isOk()) {
      return Promise.resolve(_createApiStatusObj('mongodb', 200, options && options.required))
    } else {
      return Promise.resolve(_createApiStatusObj('mongodb', 503, options && options.required))
    }
  }
}).registerWith(registry)

createUtility({
  implements: IHealthCheck,
  name: 'kth-node-system-check',

  status: function (localSystems, subSystems) {
    // Handle if we don't have subsystems
    subSystems = subSystems || [Promise.resolve(undefined)]

    // Consolidate all results
    return Promise.all(subSystems)
      .then((results) => {
        const outp = {}
        results.forEach((status) => {
          if (typeof status === 'object') {
            outp[status.key] = status
          }
        })
        return Promise.resolve(outp)
      })
      .then((subSystems) => {
        return localSystems.then((result) => Promise.resolve({localSystems: result, subSystems: subSystems}))
      })
      .then((result) => {
        const subSystems = result.subSystems
        const localSystems = result.localSystems

        var systemOk = Object.keys(subSystems).reduce((systemOk, apiKey) => {
          return systemOk && (subSystems[apiKey].required ? subSystems[apiKey].statusCode === 200 : true)
        }, localSystems.statusCode === 200)

        return Promise.resolve({
          statusCode: (systemOk ? 200 : 503),
          message: (systemOk ? 'OK' : 'ERROR'),
          subSystems: subSystems
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
