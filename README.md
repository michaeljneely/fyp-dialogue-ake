[![Build Status](https://travis-ci.org/michaeljneelysd/Final-Year-Project.svg?branch=master)](https://travis-ci.org/michaeljneelysd/Final-Year-Project)
[![Dependency Status](https://david-dm.org/michaeljneelysd/Final-Year-Project.svg)](https://david-dm.org/michaeljneelysd/Final-Year-Project)
[![devDependencies Status](https://david-dm.org/michaeljneelysd/Final-Year-Project/dev-status.svg)](https://david-dm.org/michaeljneelysd/Final-Year-Project?type=dev)
[![Coverage Status](https://coveralls.io/repos/github/michaeljneelysd/Final-Year-Project/badge.svg?branch=master)](https://coveralls.io/github/michaeljneelysd/Final-Year-Project?branch=master)
[![License](https://img.shields.io/dub/l/vibe-d.svg)](https://opensource.org/licenses/MIT)

# My FYP Application

This final year project is concerned with the research and development of a model to summarize spontaneous dialog between two or more parties. A thorough examination of the domain characteristics and challenges associated with interpersonal conversations will be conducted to define an appropriate baseline system, which will be evaluated on several test collections and compared against the performance of existing models.

Forked from Microsoft's [TypeScript-Node-Starter](https://github.com/Microsoft/TypeScript-Node-Starter)

# Pre-reqs
To build and run this app locally you will need a few things:
- Install [Node.js](https://nodejs.org/en/)
- Install [MongoDB](https://docs.mongodb.com/manual/installation/)
- Install [VS Code](https://code.visualstudio.com/)
- Install [Docker](https://www.docker.com/get-docker)
- Install [Redis](https://redis.io/download)

 Getting started
- Clone the repository
```
git clone --depth=1 https://github.com/michaeljneelysd/Final-Year-Project.git <project_name>
```
- Install dependencies
```
cd <project_name>
npm install
```
- Configure your mongoDB server
```
# create the db directory
sudo mkdir -p /data/db
# give the db correct read/write permissions
sudo chmod 777 /data/db
```
- Start your mongoDB server (you'll probably want another command prompt)
```
mongod
```
- Start your Redis server (you'll probably want another command prompt)
```
redis-server
```
- Build and Run the Stanford CoreNLP Docker Image (you'll probably want another command prompt)
```
bash run.sh
```
- Build and run the project
```
npm run build
npm start
```
Or, if you're using VS Code, you can use `cmd + shift + b` to run the default build task (which is mapped to `npm run build`), and then you can use the command palette (`cmd + shift + p`) and select `Tasks: Run Task` > `npm: start` to run `npm start` for you.

> **Note on editors!** - TypeScript has great support in [every editor](http://www.typescriptlang.org/index.html#download-links), but this project has been pre-configured for use with [VS Code](https://code.visualstudio.com/). 
Throughout the README I'll try to call out specific places where VS Code really shines or where this project has been setup to take advantage of specific features.

Finally, navigate to `http://localhost:3000` and you should see the template being served and rendered locally!

## Getting TypeScript
TypeScript itself is simple to add to any project with `npm`.
```
npm install -D typescript
```
If you're using VS Code then you're good to go!
VS Code will detect and use the TypeScript version you have installed in your `node_modules` folder. 
For other editors, make sure you have the corresponding [TypeScript plugin](http://www.typescriptlang.org/index.html#download-links). 
