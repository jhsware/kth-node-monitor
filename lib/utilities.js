'use strict'

/**
 * System controller support functions for /monitor
 */
const { safeGet } = require('safe-utils')
const registry = require('component-registry').globalRegistry
const { createUtility } = require('component-registry')
const Promise = require('bluebird')

const IHealthCheck = require('./interfaces').IHealthCheck

function _createApiStatusObj (key, statusCode, required, responseTime) {
  var message
  if (statusCode === 200) {
    message = `API_STATUS: ${key} is OK` + (responseTime ? ` (${responseTime}ms)` : '') + (required ? ' (required)' : '')
  } else {
    message = `API_STATUS: ${key} responded with status ${statusCode}` + (responseTime ? ` (${responseTime}ms)` : '')
    message += (required ? ' (WARNING! This API is required to be ok for system to report ok)' : ' (This API is NOT required to be ok for system to report ok)')
  }

  return {
    key: key,
    statusCode: statusCode,
    required: required,
    message: message,
    responseTime: responseTime
  }
}

const apiCallCache = {}
function _setCache (key, statusObj) {
  apiCallCache[key] = { statusObj: statusObj, timestamp: Date.now()}
}
function _getCache (key) {
  return apiCallCache[key]
}
createUtility({
  implements: IHealthCheck,
  name: 'kth-node-api',

  status: function (endpoint, options) {
    // Check that we haven't called this endpoint during the last 1000ms to avoid flooding monitor pages
    // or feedback loops
    const endpointBaseUri = safeGet(() => endpoint.config.proxyBasePath)

    if (endpointBaseUri === undefined) {
      // We couldn't resolve the endpoint
      return Promise.resolve(_createApiStatusObj(endpoint.key, 400, options && options.required))
    } else if (safeGet(() => (Date.now() - _getCache(endpointBaseUri).timestamp) < 1000)) {
      // We got a hit in the cache
      const statusObj = safeGet(() => _getCache(endpointBaseUri).statusObj)

      // Adding cacheTimestamp props to returned object if result was taken from cache
      const outp = Object.assign({}, statusObj, { cacheTimestamp: _getCache(endpointBaseUri).timestamp})
      outp.message = outp.message + ' --- cached (' + (Date.now() - _getCache(endpointBaseUri).timestamp) + 'ms)' 
      return Promise.resolve(outp)
    } else {
      // We need to perform a request to api _monitor page
      // TODO: Set header accepts: application/json
      const t0 = Date.now()
      return endpoint.client.getAsync({
        uri: endpointBaseUri + '/_monitor'
      }).then((data) => {
        const statusObj = _createApiStatusObj(endpoint.key, data.statusCode, options && options.required, Date.now() - t0)
        _setCache(endpointBaseUri, statusObj)
        return Promise.resolve(statusObj)
      })
      .catch(() => {
        const statusObj = _createApiStatusObj(endpoint.key, 503, options && options.required)
        _setCache(endpointBaseUri, statusObj)
        return Promise.resolve(statusObj)
      })
    }
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
