"use strict";

var childProcess = require("child_process");
var spawn = childProcess.spawn;
var exec = childProcess.exec;

// return child processes of pid that appear to be suspiciously hanging around
// within the scope of gracefulExitTimeout
function getZombieChildren (pid, gracefulExitTimeout, callback) {
  var startTime = Date.now();
  var SCAN_INTERVAL = 500;

  // NOTE: on some platforms, the ps command itself appears as a child of pid.
  // This is a short lived child so it doesn't count as a zombie, hence we're
  // only likely to see it once. This COULD lead to false positives if we're
  // on a system that is rotating through pids at an extremely high rate.
  var seenPidCounts = {};
  var numScans = 0;

  var checkForZombies = function () {
    var tree = getTree(pid, function (tree) {
      numScans++;
      var children = tree[pid];
      if (children && children.length > 0) {
        // 1. delete pids that we saw before but we DON'T see now
        Object.keys(seenPidCounts).forEach(function (seenPid) {
          if (children.filter(function (childPid) {
            return childPid.toString() === seenPid.toString();
          }).length === 0) {
            // if seenPid is not in the latest tree, remove it from seenPids
            delete seenPidCounts[seenPid.toString()];
          }
        });

        // 2. add pids that we see now, increment ones we've seen before *and* see now
        children.forEach(function (childPid) {  
          if (seenPidCounts.hasOwnProperty(childPid.toString())) {
            seenPidCounts[childPid.toString()]++;
          } else {
            seenPidCounts[childPid.toString()] = 1;
          }
        });

        // 3. determine if we have zombies
        var zombies = Object.keys(seenPidCounts).filter(function (seenPid) {
          return seenPidCounts[seenPid.toString()] > 1;
        });

        //
        // 4:
        //    A) if NO children are found at all, return empty list
        //    B) if some children exist:
        //         if we have not scanned more than once, keep scanning. No conclusions yet.
        //         if we've scanned more than once:
        //           if zombies
        //              past the gracefulExitTimeout? return list of zombies
        //              else keep scanning
        //           no zombies?
        //              return empty list
        //
        if (children.length === 0) {
          return callback([]);
        } else {
          if (numScans < 2) {
            setTimeout(checkForZombies, SCAN_INTERVAL);
          } else {
            if (zombies.length > 0) {
              if (Date.now() - startTime > gracefulExitTimeout) {
                return callback(zombies);
              } else {
                setTimeout(checkForZombies, SCAN_INTERVAL);
              }   
            } else {
              return callback([]);
            }
          }
        }
      } else {
        // we dont' see any child processes. We're good
        return callback([]);
      }
    });
  };

  checkForZombies();
}

function showDebugInfo (pid, callback) {
  var ps;
  switch (process.platform) {
    case "darwin":
      ps = spawn("pgrep", ["-P", pid, "-l"]);
      break;
    default:
      ps = spawn("ps", ["--ppid", pid]);
      break;
  }

  var allData = "";
  ps.stdout.on("data", function (data) {
    var data = data.toString("ascii");
    allData += data;
  });
  ps.on("close", function () {
    console.log("ps info for " + pid);
    console.log(allData);
    callback();
  });
}

function killChildProcesses (pid, callback) {
  getTree(pid, function (tree) {
    var children = tree[pid.toString()];

    var killNext = function () {
      if (children.length > 0) {
        treeKill(children.shift(), "SIGKILL", function () {
          killNext();
        });
      } else {
        callback();
      }
    };

    if (children && children.length > 0) {
      killNext();
    } else {
      callback();
    }
  });
}

function getTree (pid, callback) {
  var tree = {};
  var pidsToProcess = {};
  tree[pid] = [];
  pidsToProcess[pid] = 1;

  switch (process.platform) {
    case "win32":
      throw new Error("Operation unsupported on Windows");
      break;
    case "darwin":
      buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
        return spawn("pgrep", ["-P", parentPid]);
      }, function () {
        if (lib.debug) {
          showDebugInfo(pid, function () {
            callback(tree);
          })
        } else {
          callback(tree);
        }
      });
      break;
    case "sunos":
      throw new Error("Operation unsupported on SunOS");
      break;
    default: // Linux
      buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
        return spawn("ps", ["-o", "pid", "--no-headers", "--ppid", parentPid]);
      }, function () {
        if (lib.debug) {
          showDebugInfo(pid, function () {
            callback(tree);
          })
        } else {
          callback(tree);
        }
      });
      break;
  }
}

function treeKill (pid, signal, callback) {
  var tree = {};
  var pidsToProcess = {};
  tree[pid] = [];
  pidsToProcess[pid] = 1;

  switch (process.platform) {
    case "win32":
      exec("taskkill /pid " + pid + " /T /F", callback);
      break;
    case "darwin":
      buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
        return spawn("pgrep", ["-P", parentPid]);
      }, function () {
        killAll(tree, signal, callback);
      });
      break;
    case "sunos":
      throw new Error("Operation unsupported on SunOS");
      break;
    default: // Linux
      buildProcessTree(pid, tree, pidsToProcess, function (parentPid) {
        return spawn("ps", ["-o", "pid", "--no-headers", "--ppid", parentPid]);
      }, function () {
        killAll(tree, signal, callback);
      });
      break;
  }
};

function killAll (tree, signal, callback) {
  var killed = {};
  try {
    Object.keys(tree).forEach(function (pid) {
      tree[pid].forEach(function (pidpid) {
        if (!killed[pidpid]) {
          killPid(pidpid, signal);
          killed[pidpid] = 1;
        }
      });
      if (!killed[pid]) {
        killPid(pid, signal);
        killed[pid] = 1;
      }
    });
  } catch (err) {
    if (callback) {
      return callback(err);
    } else {
      throw err;
    }
  }
  if (callback) {
    return callback();
  }
}

function killPid(pid, signal) {
  signal = signal ? signal : "SIGKILL";

  try {
    process.kill(parseInt(pid, 10), signal);
  }
  catch (err) {
    if (err.code !== "ESRCH") throw err;
  }
}

function killPids(pids, signal) {
  pids.forEach(function (pid) {
    killPid(pid, signal);
  });
}

function buildProcessTree (parentPid, tree, pidsToProcess, spawnChildProcessesList, cb) {
  var ps = spawnChildProcessesList(parentPid);
  var allData = "";
  ps.stdout.on("data", function (data) {
    var data = data.toString("ascii");
    allData += data;
  });

  var onClose = function (code) {
    delete pidsToProcess[parentPid];

    if (code != 0) {
      // no more parent processes
      if (Object.keys(pidsToProcess).length == 0) {
        cb();
      }
      return;
    }

    allData.match(/\d+/g).forEach(function (pid) {
      pid = parseInt(pid, 10);
      tree[parentPid].push(pid);
      tree[pid] = [];
      pidsToProcess[pid] = 1;
      buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList, cb);
    });
  };

  ps.on("close", onClose);
}


var lib = {
  debug: false,
  kill: treeKill,
  killPid: killPid,
  getTree: getTree,
  killChildProcesses: killChildProcesses,
  getZombieChildren: getZombieChildren,
  killPids: killPids
};

module.exports = lib;