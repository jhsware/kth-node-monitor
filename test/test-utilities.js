/* eslint-env mocha */
'use strict'

// Testing libraries
const expect = require('chai').expect
const registry = require('component-registry').globalRegistry
require('../lib')
const { IHealthCheck } = require('../lib').interfaces

describe('Utilities', function () {
  it('can be found', function () {
      ['kth-node-api', 'kth-node-ldap', 'kth-node-mongodb', 'kth-node-system-check'].forEach((name) => {
        const util = registry.getUtility(IHealthCheck, name)
        expect(util).not.to.equal(undefined)
      })
  })
})