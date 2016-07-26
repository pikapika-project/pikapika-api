#!/bin/bash

while true; do
  git pull
  NODE_ENV=production npm start
done
