#!/usr/bin/python3
# coding: utf-8
import sys
import opengear.imSession as ims
s = ims.ImSession(sys.argv[1], debug=False)
r = s.get(sys.argv[2])
print(r.text)
