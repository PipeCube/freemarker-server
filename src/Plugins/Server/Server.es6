import http from 'http';
import fs from 'fs';
import http2 from 'http2';
import path from 'path';

import Koa from 'koa';
import WebSocket, {Server as WebSocketServer} from 'ws';
import bodyParser from 'koa-bodyparser';

import {util} from '../../helper';

import dispatcher from './middleware/dispatcher';
import routeMap from './middleware/routemap';
import setStaticHandler from './setStaticHandler';
import {setRender, setView} from './setRender';
import setHtmlAppender from './setHtmlAppender';

const {notify, values} = util;

class Server {
    constructor(options) {
        this.serverOptions = options;
        this.middleware = [];
        this.ifAppendHtmls = [];
        this.app = Koa({
            outputErrors: false
        });

        const {statics, Render, templatePaths, viewRoot} = options;
        const app = this.app;

        this.tplRender = setRender({
            Render, templatePaths, viewRoot
        });

        setView({
            app
        });

        setStaticHandler({
            statics, app
        })
    }

    registerRouterNamespace(name, value = []) {
        return this.serverOptions.runtimeRouters[name] = value;
    }

    getRuntimeRouters() {
        const runtimeRouters = this.serverOptions.runtimeRouters;
        return values(runtimeRouters).reduce((prev, item) => prev.concat(item), []);
    }

    updateRuntimeRouters(fn) {
        return fn(this.getRuntimeRouters());
    }
    
    delayInit() {
        const {app, ifAppendHtmls, tplRender} = this;
        const {ifProxy} = this.serverOptions;
        
        if (!ifProxy) {
            app.use(bodyParser());
        }

        // {extension, runtimeRouters, divideMethod, viewRoot, syncData, asyncData, syncDataMatch, asyncDataMatch}
        app.use(routeMap(this.serverOptions));

        this.middleware.forEach((g) => {
            app.use(g);
        });
        
        app.use(dispatcher({tplRender}));

        setHtmlAppender({app, ifAppendHtmls})
    }

    use(middleware) {
        this.middleware.push(middleware(this));
    }

    appendHtml(condition) {
        this.ifAppendHtmls.push(condition);
    }

    createServer() {
        this.delayInit();

        const {port = 3000} = this.serverOptions;
        const home = path.resolve(__dirname, '..', '..', '..');
        const httpOptions = {
            key: fs.readFileSync(path.resolve(home, 'config', 'crt', 'localhost.key')),
            cert: fs.readFileSync(path.resolve(home, 'config', 'crt', 'localhost.crt')),
        };
        const callback = this.app.callback();
        const tips = `Server build successfully on ${this.https ? 'https' : 'http'}://127.0.0.1:${port}/`;

        if (this.https) {
            this.serverApp = http2.createServer(httpOptions, callback);
        } else {
            this.serverApp = http.createServer(callback);
        }

        this.serverApp.listen(port);
        this.wss = this.buildWebSocket({
            serverApp: this.serverApp
        });

        util.log(tips);
        notify({
            title: 'Run successfully',
            msg: tips
        })
    }

    buildWebSocket({serverApp}) {
        const wss = new WebSocketServer({
            server: serverApp
        });

        wss.on('connection', ws => {
            ws.on('message', message => {
                console.log('received: %s', message);
            });
        });

        wss.broadcast = data => {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        };
        return wss;
    }
}

export default Server;