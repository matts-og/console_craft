#!/usr/bin/python3
# coding: utf-8
import sys
import json
import opengear.imSession as ims
s = ims.ImSession(sys.argv[1], debug=False)
r = None
if sys.argv[2] == 'get':
    r = s.get(sys.argv[3])
if sys.argv[2] == 'put':
    data = json.load(sys.stdin)
    #print(json.dumps(data))
    r = s.put(sys.argv[3], json.dumps(data))
if r != None:
    print(r.text)
