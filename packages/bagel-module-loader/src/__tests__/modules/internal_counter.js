const theExport = {
  count: 0,
  increment() {
    theExport.count = theExport.count + 1;
  }
};

module.exports = theExport;
