# kth-node-monitor
[![Build Status](https://travis-ci.org/jhsware/kth-node-monitor.svg?branch=master)](https://travis-ci.org/jhsware/kth-node-monitor)

Helper utilities for KTH/node-projects (temp location)


- vi får ej svar från monitor
- nätverket är segt
- vi har cirkulära anrop
- tjänsten är helt nere

Circular dependecies
- on start up and REQUIRED dep is down
    we add subsystems from ../init/api and a dependecy won't be checked
    until the apiClient has been correctly initiated so we will be staged
    by Netscaler

- running and REQUIRED dep goes down
    we will report fail and be unstaged by Netscaler, when dep is started and
    staged again we will report OK and we will be staged by Netscaler again

- if circular deps and roundtrip takes more than 1s
    there will be an infinite call loop and the original caller will time out
    and if REQUIRED will cause unstaging by Netscaler. Then all deps will be unstaged. 
    Services will need to be restarted in order to return OK and be staged by Netscaler
