var http = require('http');

var consoles = {};

function invokeLater(fn) {
    if (__plugin.bukkit) {
      server.scheduler[
        'runTaskAsynchronously(org.bukkit.plugin.Plugin, java.lang.Runnable)'
      ](__plugin, fn);
      return;
    }
    if (__plugin.canary) {
      setTimeout(fn, 20);
      return;
    }
}

function get_ckey(d) {
    var ckey = 'loc_'+d.x+'_'+d.y+'_'+d.z;
    return ckey;
}

function api_request_get(player, hostname, endpoint) {
    var autotest_dir = new java.io.File("/home/matts/data/src/auto-test");
    var p1 = java.lang.Runtime.getRuntime().exec(
        ["./api_request.py", hostname, endpoint], [], autotest_dir);
    var returnVal = p1.waitFor();
    if (returnVal != 0) {
        echo(player, hostname + ' api_request failed');
        return [false, {}];
    }
    var p1in = new java.io.BufferedReader(new java.io.InputStreamReader(p1.getInputStream()));
    var responseBody = ''
    var line;
    while ((line = p1in.readLine()) != null) {
        //echo(player, line);
        responseBody += line;
    }
    p1in.close();
    var responseJSON = {};
    var json_ok = false;
    try {
        responseJSON = JSON.parse(responseBody);
        json_ok = true;
    } catch (err) {
        echo(player, err.message);
    }
    return [json_ok, responseJSON];

}

function show_ports(player, hostname, devclass, d) {
    var api_result;
    var ports;
    if (devclass == 'platypus') {
        api_result = api_request_get(player, hostname, "ports");
        if (!api_result[0]) {
            return;
        }
        var json = api_result[1];
        ports = json.ports;
    } else {
        // OGCS
        api_result = api_request_get(player, hostname, "serialPorts");
        if (!api_result[0]) {
            return;
        }
        var json = api_result[1];
        //echo(player, JSON.stringify(json.serialports[0]));
        ports = json.serialports;
    }

    var ports_len = ports.length;
    for (var i = 0; i < ports_len; i++) {
        var port = ports[i];
        var port_block = blocks.wool.lightgray;
        if (port.mode != 'disabled') {
            port_block = blocks.wool.cyan;
        }
        d.down().back()
        .box(blocks.iron, 1,1,3)
        .up().fwd(2)
        .box(port_block)
        .up()
        .signpost([port.label, port.mode])
        .down().right().back();
    }
}

function ping_console(player, console, d) {
    d.box(blocks.wool.lightgray);
    var hostname = console.hostname;
    var p1 = java.lang.Runtime.getRuntime().exec("ping -c 1 " + hostname);
    var returnVal = p1.waitFor();
    var reachable = (returnVal==0);
    if (!reachable) {
        echo(player, hostname + ' is not reachable');
        d.box(blocks.wool.black);
    } else {
        d.box(blocks.wool.green);
    }
    return reachable;
}

function ping_console_later(player, console, d) {
    invokeLater(function(){
        ping_console(player, console, d);
    });
}

function load_console(player, console, d) {
    invokeLater(function() {
        var hostname = console.hostname;
        d.right();
        if (!ping_console(player, console, d)) {
            return;
        }
        var api_result = api_request_get(player, hostname, "system/version");
        if (!api_result[0]) {
            return;
        }
        responseJSON = api_result[1];
        var devclass = 'platypus'
        if ('etc_version' in responseJSON.system_version) {
            devclass = responseJSON.system_version.etc_version.split(" ")[0].split("/")[1];
        }

        d.box(blocks.wool.lime)
        .up().signpost(['Firmware Version:',
            responseJSON.system_version.firmware_version,
            "Class:",
            devclass])
        .down().back().right();
        show_ports(player, hostname, devclass, new Drone(d.x, d.y, d.z, d.dir, d.world));
    });
}

command('get-consoles', function(parameters, player) {
    var do_load = false;
    if (parameters.length > 0) {
        if (parameters[0] == 'load') {
            do_load = true;
        }
    }
    consoles = {};
    var d = new Drone(player);
    echo(player, 'TEST');
    http.request('http://matts.bne.opengear.com/cgi-bin/axfr',function(responseCode, responseBody){
        echo(player, 'HTTP response code: ' + responseCode.toString())
        jsResponse = JSON.parse( responseBody );
        for (var key in jsResponse) {
            echo(player, key);
            d.box(blocks.stairs.quartz)
            .fwd()
            .box(blocks.iron, 4,1,3)
            .up().fwd(2).right()
            .box(blocks.iron)
            .up()
            .signpost([key])
            .down();
            var ckey = get_ckey(d);
            consoles[ckey] = {
                'hostname' : key,
                'dir' : d.dir,
            };
            var console = consoles[ckey];
            if (do_load) {
                load_console(player, consoles[ckey], new Drone(d.x, d.y, d.z, d.dir, d.world));
            } else {
                d.right();
                ping_console_later(player, console, new Drone(d.x, d.y, d.z, d.dir, d.world));
                d.left();
            }
            d.left();
        }
    });
});

command('load-console', function(parameters, player) {
    var d = new Drone(player);
    var ckey = get_ckey(d);
    if (!ckey in consoles) {
        echo('Must point at block below signpost with console name');
        return;
    }
    var console = consoles[ckey];
    load_console(player, console, new Drone(d.x, d.y, d.z, console.dir, d.world));
});
