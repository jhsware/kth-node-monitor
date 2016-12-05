# kth-node-monitor
[![Build Status](https://travis-ci.org/jhsware/kth-node-monitor.svg?branch=master)](https://travis-ci.org/jhsware/kth-node-monitor)

Helper utilities for KTH/node-projects (temp location)


- no answer from _monitor
- slow response times
- circular dependencies
- service down

Circular dependecies
- on start up and REQUIRED dep is down
    we add subsystems from ../init/api and a dependecy won't be checked
    until the apiClient has been correctly initiated so we will be staged
    by Netscaler

- running and REQUIRED dep goes down
    we will report fail and be unstaged by Netscaler, when dep is started and
    staged again we will report OK and we will be staged by Netscaler again

- running and REQUIRED dep goes up again

- if circular deps and roundtrip takes more than 1s
    there will be an infinite call loop and the original caller will time out
    and if REQUIRED will cause unstaging by Netscaler. Then all deps will be unstaged. 
    Services will need to be restarted in order to return OK and be staged by Netscaler


### Development Notes ###

If we have issues with recursive rependencies that resolve slowly we will need to implement one or both of the following: 

LIFECYCLE JSON CALLS

PENDING -- starting shows pending for 30secs regardless of state of REQUIRED dependecies 
    to allow consuming services to start up, OR if REQUIRED dependencies have status pending
    PENDING resolves to OK as text to please Netscaler
OK -- all REQUIRED dependencies are OK
ERROR -- at least one (1) REQUIRED dep is down

pass formData on requests

{
    resolved: ['uri/to/service']
}

To handle recursive references we need:

Starting service:
- if required are OK             OK | OK
- if required are PENDING        OK | PENDING
- if required are ERROR or down  OK | PENDING
After 30s:
- if required are OK             OK | OK
- if required are PENDING        OK | PENDING
- if required are ERROR       ERROR | ERROR
Required goes down            ERROR | ERROR
Required goes up again
- if required PENDING            OK | PENDING
- if required OK                 OK | OK
