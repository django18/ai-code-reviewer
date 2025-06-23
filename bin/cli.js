#!/usr/bin/env node

require('dotenv').config();

const { program } = require('../dist/cli');

program.parse(process.argv);