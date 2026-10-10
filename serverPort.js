function resolvePort(explicitPort, environmentPort, thirdTour) {
  if(explicitPort !== undefined && explicitPort !== '') return Number(explicitPort);
  if(environmentPort !== undefined && environmentPort !== '') return Number(environmentPort);
  return thirdTour ? 8443 : 8080;
}

module.exports = resolvePort;
