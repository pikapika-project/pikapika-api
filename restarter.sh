#!/bin/bash

ulimit -n 4096

while true; do
  #git pull && npm update
  NODE_ENV=production npm start
done
