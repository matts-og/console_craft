var http = require('http');
var utils = require('utils');

var consoles_registry = {};
var ports_registry = {};
events.on(org.bukkit.event.block.BlockBreakEvent, handleBlockBreak);
var autotest_dir = new java.io.File("/home/matts/data/src/auto-test");


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

function get_ckey_xyz(x,y,z) {
    var ckey = 'loc_'+x+'_'+y+'_'+z;
    return ckey;
}

function get_ckey_of_block(block) {
    var x = block.getX();
    var y = block.getY();
    var z = block.getZ();
    return get_ckey_xyz(x, y, z);
}

function read_api_result(player, hostname, p1) {
    //var returnVal = p1.waitFor();
    //if (returnVal != 0) {
    //    echo(player, hostname + ' api_request failed');
    //    return [false, {}];
    //}
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
        echo(player, hostname + ': ' + err.message);
    }
    return [json_ok, responseJSON];
}

function api_request_get(player, hostname, endpoint) {
    var p1 = java.lang.Runtime.getRuntime().exec(
        ["./api_request.py", hostname, 'get', endpoint], [], autotest_dir);
    return read_api_result(player, hostname, p1);
}

function api_request_send(player, hostname, method, endpoint, json_obj) {
    var p1 = java.lang.Runtime.getRuntime().exec(
        ["./api_request.py", hostname, method, endpoint], [], autotest_dir);
    var p1out = new java.io.BufferedWriter(new java.io.OutputStreamWriter(p1.getOutputStream()));
    p1out.write(JSON.stringify(json_obj));
    p1out.flush();
    p1out.close();
    return read_api_result(player, hostname, p1);
}

function show_port(port, portr, d) {
    var port_block = blocks.wool.lightgray;
    var devclass = portr.console.devclass;
    if (port.mode != 'disabled') {
        port_block = blocks.wool.cyan;
    }
    var baud;
    if (devclass == 'platypus') {
        baud = port.baudrate;
    } else {
        baud = port.hardwareSettings.uart.baud;
    }
    d.box(port_block)
    .up()
    .signpost([port.label, port.mode, baud])
    .down()
}

function show_ports(player, console, d) {
    var api_result;
    var ports;
    var hostname = console.hostname;
    var devclass = console.devclass;
    d.box(blocks.cobweb);
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
    d.box(blocks.air);
    var ports_len = ports.length;
    for (var i = 0; i < ports_len; i++) {
        var port = ports[i];
        d.down().back(2)
        .box(blocks.air, 2,5,3)
        .box(blocks.iron, 1,1,3)
        .up().fwd(2);
        var port_ckey = get_ckey(d);
        ports_registry[port_ckey] = {
            'console' : console,
            'id' : port.id,
            'mode' : port.mode
        };
        show_port(port, ports_registry[port_ckey], d);
        d.right();
    }
}

function ping_console(player, console, d) {
    d.box(blocks.cobweb);
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
        d.box(blocks.cobweb);

        var api_result = api_request_get(player, hostname, "system/version");
        if (!api_result[0]) {
            return;
        }
        responseJSON = api_result[1];
        var devclass = 'platypus'
        if ('etc_version' in responseJSON.system_version) {
            devclass = responseJSON.system_version.etc_version.split(" ")[0].split("/")[1];
        }
        console.devclass = devclass;

        d.box(blocks.wool.lime)
        .up().signpost(['Firmware Version:',
            responseJSON.system_version.firmware_version,
            "Class:",
            devclass])
        .down().right();
        show_ports(player, console, new Drone(d.x, d.y, d.z, d.dir, d.world));
    });
}

function ports_url_root(port) {
    var res = 'serialPorts/';
    if (port.console.devclass == 'platypus') {
        res = 'ports/';
    }
    return res;
}

function port_root(port) {
    var res = 'serialport';
    if (port.console.devclass == 'platypus') {
        res = 'port';
    }
    return res;
}

function ports_root(port) {
    var res = 'serialports';
    if (port.console.devclass == 'platypus') {
        res = 'ports';
    }
    return res;
}

function get_port(player, port) {
    // set port as consoleServer
    return api_request_get(player, port.console.hostname, ports_url_root(port) + port.id);
}

function enable_port(player, port, d) {
    invokeLater(function(){
        d.box(blocks.cobweb);
        var request_res = get_port(player, port);
        if (!request_res[0]) {
            return;
        }
        var port_obj = request_res[1];
        d.box(blocks.grass_tall);
        //echo(player, JSON.stringify(port_obj));
        port_obj[port_root(port)].mode = 'consoleServer';
        port_obj[port_root(port)].hardwareSettings.uart.baud = '115200';
        port_obj[port_root(port)].modeSettings = {
            "consoleServer": {
                "ssh": {
                "enabled": true,
                "unauthenticated": false
                },
                "telnet": {
                "enabled": false,
                "unauthenticated": false
                },
                "general": {
                "replaceBackspace": false,
                "escapeChar": "~",
                "singleConnection": false,
                "accumulateMS": 0,
                "powerMenuEnabled": false
                },
                "portShare": {
                "password": "",
                "authentication": false,
                "enabled": false,
                "encryption": false
                },
                "rfc2217": {
                "enabled": false
                },
                "webShell": {
                "enabled": false
                },
                "tcp": {
                "enabled": false
                },
                "ipAlias": {
                "wan": [],
                "oobfo": [],
                "wlan": [],
                "lan": []
                }
            }
        };
        var send_res = api_request_send(player, port.console.hostname, 'put',
            ports_url_root(port) + port.id, port_obj);
        if (send_res[0]) {
            //echo(player, 'Got ' + JSON.stringify(send_res[1]));
            show_port(send_res[1][port_root(port)], port, d);
            port.mode = send_res[1][port_root(port)].mode
        }
    });
}

function disable_port(player, port, d) {
    invokeLater(function(){
        d.box(blocks.cobweb);
        var request_res = get_port(player, port);
        if (!request_res[0]) {
            return;
        }
        var port_obj = request_res[1];
        d.box(blocks.grass_tall);
        //echo(player, JSON.stringify(port_obj));
        port_obj[port_root(port)].mode = 'disabled';
        port_obj[port_root(port)].hardwareSettings.uart.baud = '9600';
        port_obj[port_root(port)].modeSettings = {
            "disabled": {}
        };
        var send_res = api_request_send(player, port.console.hostname, 'put',
            ports_url_root(port) + port.id, port_obj);
        if (send_res[0]) {
            //echo(player, 'Got ' + JSON.stringify(send_res[1]));
            show_port(send_res[1][port_root(port)], port, d);
            port.mode = send_res[1][port_root(port)].mode
        }
    });
}

function handleBlockBreak(event, cancel) {
    var block = event.block;
    var ckey = get_ckey_of_block(block);
    if (ckey in consoles_registry) {
        cancel();
        var console = consoles_registry[ckey];
        echo(event.player, "Loading console " + console.hostname);
        load_console(event.player, console,
            new Drone(block.getX(), block.getY(), block.getZ(), console.dir, console.world));
    } else if (ckey in ports_registry) {
        cancel();
        var port = ports_registry[ckey];
        echo(event.player, "Toggling port " + port.id);
        if (port.mode == 'disabled') {
            enable_port(event.player, port,
                new Drone(block.getX(), block.getY(), block.getZ(), port.console.dir, port.console.world));
        } else {
            disable_port(event.player, port,
                new Drone(block.getX(), block.getY(), block.getZ(), port.console.dir, port.console.world));
        }
    }
}

command('get-consoles', function(parameters, player) {
    var do_load = false;
    if (parameters.length > 0) {
        player = utils.player(parameters[0]);
    }
    if (parameters.length > 1) {
        if (parameters[1] == 'load') {
            do_load = true;
        }
    }
    consoles_registry = {};
    var d = new Drone(player).fwd(2).box(blocks.cobweb);
    echo(player, 'TEST');
    http.request('http://matts.bne.opengear.com/cgi-bin/axfr',function(responseCode, responseBody){
        echo(player, 'HTTP response code: ' + responseCode.toString())
        jsResponse = JSON.parse( responseBody );
        for (var key in jsResponse) {
            echo(player, key);
            d.box(blocks.stairs.quartz)
            .fwd()
            .box(blocks.air, 4,5,3)
            .box(blocks.iron, 4,1,3)
            .up().fwd(2).right()
            .box(blocks.iron)
            .up()
            .signpost([key])
            .down();
            var ckey = get_ckey(d);
            consoles_registry[ckey] = {
                'hostname' : key,
                'dir' : d.dir,
                'world' : d.world
            };
            var console = consoles_registry[ckey];
            if (do_load) {
                load_console(player, consoles_registry[ckey], new Drone(d.x, d.y, d.z, d.dir, d.world));
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
    if (!(ckey in consoles_registry)) {
        echo('Must point at block below signpost with console name');
        return;
    }
    var console = consoles_registry[ckey];
    load_console(player, console, new Drone(d.x, d.y, d.z, console.dir, console.world));
});
