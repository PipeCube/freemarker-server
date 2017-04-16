const Server = require('./Server');
const path = require('path');
const {Renderer, util: _} = require('@foxman/helpers');
const formatStaticOptions = require('./utils/formatStaticOptions');
const checkServerConfig = require('./utils/checkServerConfig');

class ServerPlugin {
    constructor(opts = {}) {
        const result = checkServerConfig(opts);
        if (result) {
            _.errorLog(result);
        }

        // TODO: 需要deepClone
        const options = Object.assign({}, opts);
        const statics = options.static ? _.ensureArray(opts.static) : [];

        options.port = options.port || 3000;
        
        options.statics = statics
            .filter(item => !!item)
            .map(formatStaticOptions);

        options.runtimeRouters = {routers: options.routers || []};

        delete options.routers;

        options.syncDataMatch = options.syncDataMatch ||
            (url => path.join(options.syncData, url));

        options.asyncDataMatch = options.asyncDataMatch ||
            (url => path.join(options.asyncData, url));

        options.divideMethod = Boolean(options.divideMethod);

        options.extension = options.extension
            ? String(options.extension)
            : 'ftl';

        options.Render = options.Render || Renderer;

        this.options = options;
    }

    init({getter}) {
        this.server = new Server(
            Object.assign(
                {
                    
                    ifProxy: getter('proxy.enable')
                },
                this.options
            )
        );
    }

    service() {
        return {
            injectScript: void 0,
            evalAlways: void 0,
            eval: void 0,
            use: void 0,
            livereload: void 0
        };
    }

    runOnSuccess() {
        this.server.start();
    }
}

module.exports = ServerPlugin;
