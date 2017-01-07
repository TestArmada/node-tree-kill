/* eslint no-undef: 0, no-unused-expressions: 0, callback-return: 0, no-unused-vars: 0,
  no-empty: 0, no-throw-literal: 0 */
"use strict";
var expect = require("chai").expect;
var ntk = require("../index");

describe("ntk", function () {
  beforeEach(function () {
    ntk.debug = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function () {}
      },
      spawn: function () {
      },
      exec: function () {
      },
      console: {
        log: function () {}
      },
      date: function () {
        return 0;
      },
      setTimeout: function (cb) {
        cb();
      }
    });
  });

  it("handles find and kill on windows", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "win32",
        kill: function () {}
      }
    });

    try {
      ntk.getTree(1, function () {});
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.be.true;

    ntk.setMocks({
      exec: function (cmd, cb) {
        expect(cmd.match(/^taskkill/)).to.not.be.null;
        cb();
      }
    });

    ntk.kill(1, 2, function () {});
  });

  it("handles find on SunOS", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "sunos",
        kill: function () {}
      }
    });

    try {
      ntk.getTree(1, function () {});
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.be.true;

    try {
      ntk.kill(1, function () {});
    } catch (e) {
      thrown = true;
    }
    expect(thrown).to.be.true;
  });

  it("handles find on darwin", function (done) {
    ntk.setMocks({
      process: {
        platform: "darwin",
        kill: function () {}
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd.match(/^pgrep/)) {
                if (args[1] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[1] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    ntk.getTree(1, function (r) {
      if (r[1].length === 3) {
        ntk.debug = true;
        ntk.getTree(1, function (r2) {
          if (r2[1].length === 3) {
            done();
          }
        });
      }
    });
  });

  it("handles kill on darwin", function () {
    ntk.setMocks({
      process: {
        platform: "darwin",
        kill: function (pid, cb) {
          cb();
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd.match(/^pgrep/)) {
                if (args[1] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[1] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    ntk.kill(1, function (r) {
    });
  });

  it("handles find on linux", function (done) {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function () {}
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    ntk.getTree(1, function (r) {
      if (r[1].length === 3) {
        ntk.debug = true;
        ntk.getTree(1, function (r2) {
          if (r2[1].length === 3) {
            done();
          }
        });
      }
    });
  });

  it("handles kill on linux", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          cb();
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    ntk.kill(1, function (err) {
    });
  });

  it("handles bad kill", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          throw new Error("Nope");
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    try {
      ntk.kill(1, function (err) {
      });
    } catch (e) {
    }

    try {
      ntk.kill(1);
    } catch (e) {
    }
  });

  it("handles killChildProcesses", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          cb();
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      }
    });

    ntk.killChildProcesses(1, function (err) {
    });
  });

  it("handles killPids", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          cb();
        }
      }
    });

    ntk.killPids([1, 2, 3], function (err) {
    });
  });

  it("handles killPids with error", function () {
    var thrown = false;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          throw {code: "ESRCH"};
        }
      }
    });

    try {
      ntk.killPids([1, 2, 3], function (err) {
      });
    } catch (e) {
    }
  });

  it("handles getZombieChildren", function () {
    var d = 0;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          cb();
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  cb("2\n3\n4");
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      },
      date: function () {
        d += 1000;
        return d;
      }
    });

    ntk.getZombieChildren(1, 10000, function (err) {
    });
  });

  it("handles getZombieChildren that kills children", function () {
    var d = 0;
    ntk.setMocks({
      process: {
        platform: "linux",
        kill: function (pid, cb) {
          cb();
        }
      },
      spawn: function (cmd, args) {
        return {
          stdout: {
            on: function (name, cb) {
              if (name === "data" && cmd === "ps") {
                if (args[4] === 1) {
                  if (d < 5000) {
                    cb("2\n3\n4");
                  } else {
                    cb("4");
                  }
                } else {
                  cb("");
                }
              }
            }
          },
          on: function (name, cb) {
            if (name === "close") {
              if (args[4] === 1) {
                cb(0);
              } else {
                cb(1);
              }
            }
          }
        };
      },
      date: function () {
        d += 1000;
        return d;
      }
    });

    ntk.getZombieChildren(1, 10000, function (err) {
    });
  });
});
