/**
 * @namespace core
 * @desc mqqapi内核的方法和属性
 */
;
(function (name, definition, undefined) {

    var exp = definition(this[name] = this[name] || {});

    if (typeof define === 'function' && (define.amd || define.cmd)) {
        define(exp);
    } else if (typeof module === 'object') {
        module.exports = exp;
    }


})('mqq', function (exports, undefined) {

    'use strict';

    var ua = navigator.userAgent,

        firebug = window.MQQfirebug, // 调试插件引用

        Report,

        // 借用方法的常量
        SLICE = Array.prototype.slice,
        TOSTRING = Object.prototype.toString,

        // 各种判断用的正则
        //
        // IOS: Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4
        //      Mozilla/5.0 (iPad; CPU OS 7_0 like Mac OS X) AppleWebKit/537.51.1 (KHTML, like Gecko) Version/7.0 Mobile/11A465 Safari/9537.53

        // ANDROID: Mozilla/5.0 (Linux; Android 4.4.4; en-us; Nexus 5 Build/JOP40D) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2307.2 Mobile Safari/537.36

        // WINDOWS PHONE: Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; Trident/6.0; IEMobile/10.0; ARM; Touch; NOKIA; Lumia 520)

        REGEXP_IOS = /\b(iPad|iPhone|iPod)\b.*? OS ([\d_]+)/,

        // fix by jdochen 2015/09/15
        // 个别低端机型UA：Android/2.3.5
        REGEXP_ANDROID = /\bAndroid([^;]+)/, // 小米的奇葩系统没有android内核的这个数字版本号啊

        // Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Mobile/11D257 QQ/5.3.2.424 NetType/WIFI Mem/46
        REGEXP_IPHONE_QQ = /\bQQ\/([\d\.]+)/,

        // Mozilla/5.0 (iPad; CPU OS 8_0 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) Mobile/12A365 IPadQQ/5.3.0.0 QQ/5.6
        REGEXP_IPAD_QQ = /\bIPadQQ\/([\d\.]+).*?\bQQ\/([\d\.]+)/,

        // Mozilla/5.0 (Linux; Android 5.0.1; Nexus 4 Build/LRX22C) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/37.0.0.0 Mobile Safari/537.36 V1_AND_SQ_4.7.0_216_HDBM_T QQ/4.7.0.2385 NetType/WIFI
        REGEXP_ANDROID_QQ = /\bV1_AND_SQI?_([\d\.]+)(.*? QQ\/([\d\.]+))?/, // 国际版的 QQ 的 ua 是 sqi
        REGEXP_X5 = /\bTBS\/([\d]+)/,
        // TODO winphone qq

        REGEXP_TRIBE = /\bTribe\/([\d\.]+)/, // 部落APP的 ua

        // 内部使用的变量
        aCallbacks = exports.__aCallbacks || {}, // 调用回调
        aReports = exports.__aReports || {}, // API 调用的名字跟回调序号的映射
        aSupports = exports.__aSupports || {}, // 保存 API 的版本支持信息
        aFunctions = exports.__aFunctions || {}, // 保存 API 的名字和生成的方法映射

        UUIDSeed = 1,

        CODE_API_CALL = -100000, // 定义为 API 调用, 跟 API 的回调区分
        CODE_API_CALLBACK = -200000, // 定义为 API 调用的返回, 但是不知道确切返回码


        // 4.7启用了新协议, 但是部分接口不支持, 这里做个黑名单, 目前都是 android 的接口
        NEW_PROTOCOL_BACK_LIST = {
            qbizApi: '5.0', // 5.0 会支持新协议
            pay: '999999', // pay相关的暂时没有修改计划
            SetPwdJsInterface: '999999', // 设置密码?
            GCApi: '999999', // 游戏中心
            q_download: '999999', // 下载器
            qqZoneAppList: '999999', //
            qzone_app: '999999', //
            qzone_http: '999999', //
            qzone_imageCache: '999999', //
            RoamMapJsPlugin: '999999' //
        },

        // 有些接口不能做上报
        NOT_REPORT_METHOD = [
            'pbReport',
            'popBack',
            'close',
            'qqVersion'
        ];


    // 如果已经注入则开启调试模式
    if (firebug) {
        exports.debuging = true;
        ua = firebug.ua || ua;
    } else {
        exports.debuging = false;
    }

    /*
     * 扩展 obj 对象
     * @param  {[type]} obj [description]
     * @param  {[type]} ext [description]
     * @return {[type]}     [description]
     */
    function extend(obj, ext, overwrite) {
        var i;

        for (i in ext) {
            if (ext.hasOwnProperty(i) && !(i in obj) || overwrite) {
                obj[i] = ext[i];
            }
        }

        return obj;
    }

    // 生成一些列的类型判断方法
    extend(exports, (function () {

        var exp = {},
            types = 'Object,Function,String,Number,Boolean,Date,Undefined,Null';

        types.split(',').forEach(function (t, i) {

            exp['is' + t] = function (obj) {
                return TOSTRING.call(obj) === '[object ' + t + ']';
            };

        });


        return exp;
    })());

    /**
     * @attribute core.iOS
     * @desc 如果在 iOS 中，值为 true，否则为 false
     * @support iOS 4.2
     * @support android 4.2
     */
    exports.iOS = REGEXP_IOS.test(ua);
    /**
     * @attribute core.android
     * @desc 如果在 android 中，值为 true，否则为 false
     * @support iOS 4.2
     * @support android 4.2
     */
    exports.android = REGEXP_ANDROID.test(ua);

    if (exports.iOS && exports.android) {

        /*
         * 同时是 iOS 和 android 是不可能的, 但是有些国产神机很恶心,
         * 明明是 android, ua 上还加上个 iPhone 5s...
         * 这里要 fix 掉
         */
        exports.iOS = false;
    }

    /**
     * @attribute core.version
     * @desc mqqapi自身的版本号
     * @support iOS 4.2
     * @support android 4.2
     */
    exports.version = '20190312004';


    /**
     * @attribute core.QQVersion
     * @desc 如果在 手机 QQ中，值为手机QQ的版本号，如：4.6.2，否则为 0
     * @support iOS 4.2
     * @support android 4.2
     */
    exports.QQVersion = '0';

    exports.clientVersion = '0';

    exports.ERROR_NO_SUCH_METHOD = 'no such method';
    exports.ERROR_PERMISSION_DENIED = 'permission denied';


    /*
     * 当a<b返回-1, 当a==b返回0, 当a>b返回1,
     * 约定当a或b非法则返回-1
     */
    function compareVersion(a, b) {
        var i, l, r, len;

        a = String(a).split('.');
        b = String(b).split('.');

        // try {
        for (i = 0, len = Math.max(a.length, b.length); i < len; i++) {
            l = isFinite(a[i]) && Number(a[i]) || 0;
            r = isFinite(b[i]) && Number(b[i]) || 0;
            if (l < r) {
                return -1;
            } else if (l > r) {
                return 1;
            }
        }

        // } catch (e) {
        //     console.error(e);
        //     return -1;
        // }

        return 0;
    }

    /**
     * @function core.compare
     * @desc 比较版本号，返回比较结果（-1，0，1）。如果当前 QQVersion 小于给定版本，返回 -1，等于返回 0，大于返回 1
     * @param {String} version
     *
     * @example
     * mqq.QQVersion = "4.7";
     * mqq.compare("10.0");// 返回-1
     * mqq.compare("4.5.1");// 返回1
     *
     * @support iOS 4.2
     * @support android 4.2
     */
    exports.compare = function (ver) {
        return compareVersion(exports.clientVersion, ver);
    };

    /*
     * 判断各种平台，手Q，iPadQQ，部落App等
     */
    exports.platform = (function () {
        var p = 'browser',
            m,
            ver;

        if (exports.android) {

            // 判断手机QQ
            if ((m = ua.match(REGEXP_ANDROID_QQ)) && m.length) {
                exports.QQVersion = exports.clientVersion = (compareVersion(m[1], m[3]) >= 0 ? m[1] : m[3]) || '0';
                p = 'AndroidQQ';
            } else if ((m = ua.match(REGEXP_TRIBE)) && m.length) { // 判断部落App
                exports.clientVersion = m[1] || '0';
                p = 'AndroidTribe';
            }

            // 兼容 android 旧接口
            window.JsBridge = window.JsBridge || {};
            window.JsBridge.callMethod = invokeClientMethod;
            window.JsBridge.callback = execGlobalCallback;
            window.JsBridge.compareVersion = exports.compare;
        }

        if (exports.iOS) {

            // 用于接收客户端返回值
            exports.__RETURN_VALUE = undefined;

            if ((m = ua.match(REGEXP_IPAD_QQ)) && m.length) {
                exports.clientVersion = m[1] || '0';
                exports.QQVersion = m[2] || exports.clientVersion; // iPadQQ 可能会模拟 QQ 的版本
                p = 'iPadQQ';
            } else if ((m = ua.match(REGEXP_IPHONE_QQ)) && m.length) {
                exports.QQVersion = exports.clientVersion = m[1] || '0';
                p = 'iPhoneQQ';
            } else if ((m = ua.match(REGEXP_TRIBE)) && m.length) { // 判断部落App
                exports.clientVersion = m[1] || '0';
                p = 'iOSTribe';
            } else {

                // ios qq 5.9.5有bug，安装完qq后第一次打开webview，ua的设置不正确，没有qq信息在里面，因此这里尝试去调用一下同步接口，判断是否是qq。qq 6.0已经修复该问题
                // 2015/11/05 by az
                ver = invokeClientMethod('device', 'qqVersion');
                if (!!ver) {
                    exports.QQVersion = exports.clientVersion = ver;
                    p = 'iPhoneQQ';
                }
            }

            // 兼容 iOS 旧接口
            window.iOSQQApi = exports;
        }

        return p;
    })();


    UUIDSeed = (function () {
        var count = 1, // 从1开始, 因为QQ浏览器的注入广告占用了0, 避免冲突
            i;

        for (i in aCallbacks) { // 有些页面会引用多份 qqapi.js，(⊙﹏⊙)b，这里对回调序号做重新矫正
            if (aCallbacks.hasOwnProperty(i)) {
                i = Number(i);

                // 事件的key值是字符串
                if (!isNaN(i)) {
                    count = Math.max(count, i);
                }
            }
        }

        return ++count;
    })();

    Report = (function () {
        var reportCache = [],
            sendFrequency = 500,
            timer = 0,
            lastTimerTime = 0,

            APP_ID = 1000218,
            TYPE_ID = 1000280,

            // 抽样比例
            sample = 100,

            mainVersion = String(exports.QQVersion).split('.').slice(0, 3).join('.'),

            releaseVersion = exports.platform + '_MQQ_' + mainVersion,

            qua = exports.platform + exports.QQVersion + '/' + exports.version;

        function sendReport() {
            var arr = reportCache,
                params = {},
                img;

            reportCache = [];
            timer = 0;

            if (!arr.length) {

                // 这次没有要上报的, 就关掉定时器
                return;
            }


            params.appid = APP_ID; // 手机QQ JS API
            params.typeid = TYPE_ID; // UDP 接口需要
            params.releaseversion = releaseVersion;

            // params.build = location.hostname + location.pathname;
            params.sdkversion = exports.version;
            params.qua = qua;
            params.frequency = sample;

            params.t = Date.now();

            params.key = ['commandid', 'resultcode', 'tmcost'].join(',');

            arr.forEach(function (a, i) {

                params[i + 1 + '_1'] = a[0];
                params[i + 1 + '_2'] = a[1];
                params[i + 1 + '_3'] = a[2];
            });

            params = new String(toQuery(params));

            // api 的上报量太大了, 后台撑不住
            if (exports.compare('4.6') >= 0) {

                // 优先用客户端接口上报
                setTimeout(function () {

                    if (mqq.iOS) {
                        // 客户端已经废弃了这个接口
                        // mqq.invokeClient('data', 'pbReport', {
                        //     type: String(10004),
                        //     data: params
                        // });
                    } else {
                        // 客户端已经废弃了这个接口
                        // mqq.invokeClient('publicAccount', 'pbReport', String(10004), params);
                    }
                }, 0);

            } else {
                img = new Image();
                img.onload = function () {
                    img = null;
                };

                img.src = 'http://wspeed.qq.com/w.cgi?' + params;
            }

            timer = setTimeout(sendReport, sendFrequency);
        }

        function send(api, retCode, costTime) {
            var mod;

            // API调用进行抽样上报, 返回则不抽样
            if (retCode === CODE_API_CALL) {

                retCode = 0; // API 调用的状态码用回 0
                mod = Math.round(Math.random() * sample) % sample;
                if (mod !== 1) {
                    return;
                }
            }

            reportCache.push([api, retCode || 0, costTime || 0]);

            // if(Date.now() - lastTimerTime < sendFrequency){

            //     // 连续的 sendFrequency 时间内的上报都合并掉
            //     clearTimeout(timer);
            //     timer = 0;
            // }
            if (!timer) {
                lastTimerTime = Date.now();
                timer = setTimeout(sendReport, sendFrequency);
            }

        }

        return {
            send: send
        };

    })();

    function log(params) {
        var firebug = window.MQQfirebug;

        if (exports.debuging && firebug && firebug.log && params.method !== 'pbReport') {
            try {
                firebug.log(params);
            } catch (e) { }
        }
    }

    /*
     * 上报 API 调用和把 API 的回调跟 API 名字关联起来, 用于上报返回码和返回时间
     */
    function reportAPI(schema, ns, method, argus, sn) {

        if (!schema || !ns || !method) {

            // 非正常的 API 调用就不上报了
            return;
        }

        var uri = schema + '://' + ns + '/' + method,
            a, i, l, m;

        argus = argus || [];

        if (!sn || !(aCallbacks[sn] || window[sn])) {

            // 尝试从参数中找到回调参数名作为 sn
            sn = null;
            for (i = 0, l = argus.length; i < l; i++) {
                a = argus[i];
                if (exports.isObject(a)) {

                    a = a.callbackName || a.callback;
                }

                if (a && (aCallbacks[a] || window[a])) {
                    sn = a;
                    break;
                }
            }
        }

        if (sn) { // 记录 sn 和 uri 的对应关系
            // 新增na, method，用于debug模式输出
            aReports[sn] = {
                from: 'reportAPI',
                ns: ns,
                method: method,
                uri: uri,
                startTime: Date.now()
            };
            m = String(sn).match(/__MQQ_CALLBACK_(\d+)/);
            if (m) { //  兼容直接使用 createCallbackName 生成回调的情况
                aReports[m[1]] = aReports[sn];
            }
        }

        // Console.debug('sn: ' + sn, aReports);
        // 发上报请求
        Report.send(uri, CODE_API_CALL);
    }

    /*
     * 创建名字空间
     * @param  {String} name
     */
    function createNamespace(name) {
        var arr = name.split('.'),
            space = window;

        arr.forEach(function (a) {
            !space[a] && (space[a] = {});
            space = space[a];
        });
        return space;
    }

    /**
     * @function core.callback
     * @desc 用于生成回调名字，跟着 invoke 的参数传给客户端，客户端执行回调时，根据该回调名字找到相应的回调处理函数并执行
     * @param {Function} handler 接口的回调处理函数
     * @param {Boolean} [deleteOnExec] 若为 true 则执行完该回调之后删除之，用于防止同一个回调被多次执行（某些情况下有用）
     * @param {Boolean} [execOnNewThread] 若为 true 则在另一个线程执行回调，iOS 中，以下两种场景须指定该参数为 true
     * @default for execOnNewThread true
     *
     * @important 如果在 UI 相关接口的回调中调用 alert 等 UI 接口，会导致 WebView 假死，只能关进程处理
     * @important 如果在接口 A 的回调中继续调用接口 B，接口 B 的调用可能会无效亦或者返回结果不正确
     *
     * @example
     * var callbackName = mqq.callback(function(type, index){
     *     console.log("type: " + type + ", index: " + index);
     * });
     * //弹出 ActionSheet
     * mqq.invoke("ui", "showActionSheet", {
     *     "title" : "title",
     *     "items" : ["item1", "item2"],
     *     "cancel" : "cancel",
     *     "close" : "close",
     *     "onclick": callbackName
     * }
     *
     * @support iOS 4.2
     * @support android 4.2
     */
    function createCallbackName(callback, deleteOnExec, execOnNewThread) {
        var sn, name;

        callback = exports.isFunction(callback) ? callback : window[callback];
        if (!callback) {
            return;
        }

        // // 默认执行一遍后就删掉
        // if (exports.isUndefined(deleteOnExec)) {
        //     deleteOnExec = true;
        // }

        sn = storeCallback(callback);

        name = '__MQQ_CALLBACK_' + sn;

        // alert(name)

        window[name] = function () {

            var argus = SLICE.call(arguments);

            fireCallback(sn, argus, deleteOnExec, execOnNewThread);

        };

        return name;
    }

    function storeCallback(callback) {
        var sn = '' + UUIDSeed++;

        if (callback) {
            /*window[sn] = */
            aCallbacks[sn] = callback;
        }

        return sn;
    }

    /*
     * 从 obj 中找出错误码
     * @param  {Object} obj
     */
    function getResultCode(obj) {
        var retCode, j, n,
            keys = ['retCode', 'retcode', 'resultCode', 'ret', 'code', 'r'];

        for (j = 0, n = keys.length; j < n; j++) {
            if (keys[j] in obj) {
                retCode = obj[keys[j]];
                break;
            }
        }

        return retCode;
    }

    /*
     * 所有回调的最终被执行的入口函数
     */
    function fireCallback(sn, argus, deleteOnExec, execOnNewThread) {
        // alert(JSON.stringify(arguments))

        var callback = exports.isFunction(sn) ? sn : (aCallbacks[sn] || window[sn]),
            endTime = Date.now(),
            result,
            retCode,
            obj;

        argus = argus || [];
        result = argus[0];

        // 默认都在新线程执行
        if (exports.isUndefined(execOnNewThread)) {
            execOnNewThread = true;
        }

        // 统一回调格式 { code: 0, msg: "", data: {} }
        if (exports.isObject(result)) {

            if (!('data' in result)) {
                result.data = extend({}, result);
            }

            if (!('code' in result)) {
                result.code = getResultCode(result) || 0;
            }

            result.msg = result.msg || '';

        }

        if (exports.isFunction(callback)) {

            if (execOnNewThread) {
                setTimeout(function () {
                    // alert(callback)
                    callback.apply(null, argus);
                }, 0);
            } else {
                callback.apply(null, argus);
            }
        } else {

            console.log('mqqapi: not found such callback: ' + sn + ' or the callback: ' + sn + ' had some errors! API: ' + (sn && sn.name || ''));
        }

        if (deleteOnExec) {
            delete aCallbacks[sn];
            delete window['__MQQ_CALLBACK_' + sn];
        }

        // 上报 API 调用返回
        // alert(sn)
        if (aReports[sn]) {
            obj = aReports[sn];
            delete aReports[sn];

            // 输出结果, 上报数据不输出
            log({
                from: 'fireCallback',
                ns: obj.ns,
                method: obj.method,
                ret: JSON.stringify(argus),
                url: obj.uri
            });

            if (Number(sn)) {
                delete aReports['__MQQ_CALLBACK_' + sn];
            }

            if (result) { // 只取第一个参数来判断

                if (result.code !== undefined) {
                    retCode = result.code;
                } else if (/^-?\d+$/.test(String(result))) { // 第一个参数是个整数, 认为是返回码
                    retCode = result;
                }
            }

            // 发上报请求
            Report.send(obj.uri + '#callback', retCode, endTime - obj.startTime);
        }
    }

    /*
     * android / iOS 5.0 开始, client回调 js, 都通过这个入口函数处理
     */

    function execGlobalCallback(sn) {

        // alert(JSON.stringify(arguments))

        var argus = SLICE.call(arguments, 1);

        if (exports.android && argus && argus.length) {

            // 对 android 的回调结果进行兼容
            // android 的旧接口返回会包装个 {r:0,result:123}, 要提取出来
            argus.forEach(function (data, i) {
                if (exports.isObject(data) && ('r' in data) && ('result' in data)) {
                    argus[i] = data.result;
                }
            });
        }

        // alert(argus)

        fireCallback(sn, argus);
    }

    /*
     * 空的api实现, 用于兼容在浏览器调试, 让mqq的调用不报错
     */
    function emptyAPI() {
        // var argus = SLICE.call(arguments);
        // var callback = argus.length && argus[argus.length-1];
        // return (typeof callback === 'function') ? callback(null) : null;
    }

    /**
     * @function core.build
     * @desc 创建 api 方法, 把指定 api 包装为固定的调用形式
     * @param {String} name 需创建的命名空间，如：'mqq.ui.openUrl'
     * @param {Object} data 接口配置信息（包含接口在iOS/android/browser端的执行以及各平台手Q支持的版本）
     *
     * @example
     * mqq.build("ui.openUrl", {
     *     android: function(){},
     *     iOS: fucntion(){},
     *
     *     AndroidQQ: function(){},
     *     iPhoneQQ: fucntion(){},
     *     iPadQQ: function(){},
     *     Buluo: function(){},
     *     browser: function(){}, // 某些 api 可能有浏览器兼容的方式
     *     support: {
     *         AndroidQQ: '4.5',
     *         iPhoneQQ: '4.5',
     *         iPadQQ: '4.5',
     *         Buluo: '4.5'
     *     }
     * })
     *
     * @support iOS 4.2
     * @support android 4.2
     */
    function buildAPI(name, data) {
        var func = null,
            str,
            mayRecursive = false,
            plat = exports.platform,
            arr = name.split('.'),
            index = name.lastIndexOf('.'),

            nsName = arr[arr.length - 2],
            methodName = arr[arr.length - 1],
            ns = createNamespace(name.substring(0, index));

        // 该处增加debug状态判断，允许某些调试行为刻意重写`mqq`方法
        if (ns[methodName] && !exports.debuging) {

            // 多次挂载mqq会导致同一方法多次创建而导致报错终止
            return;
        }

        if (!(func = data[exports.platform]) && plat !== 'browser') {

            // 没有指定特殊平台，且不是浏览器的环境，则尝试用通用的 iOS 和android 去找
            if (func = exports.iOS && data.iOS) {
                plat = 'iOS';
            } else if (func = exports.android && data.android) {
                plat = 'android';
            }
        }

        if (func && data.supportInvoke) {

            // 缓存起来，用于兼容标准的方式调用
            aFunctions[nsName + '.' + methodName] = func;
        }

        // if (func && !data.supportSync) {

        //     var func2 = function() {
        //         var argus = SLICE.call(arguments),
        //             self = this;

        //         setTimeout(function() {
        //             func.apply(self, argus);
        //         }, 0);
        //     };
        // }

        ns[methodName] = func ? func : emptyAPI;

        // 用于 supportVersion 判断
        if (data.support && data.support[plat]) {
            aSupports[nsName + '.' + methodName] = data.support[plat];
        }


    }


    /**
     * @function core.support
     * @desc 检查当前手机QQ环境是否支持该接口，返回 true 则表示支持该接口；false 则不支持。
     * @param {String} apiName 接口名字
     * @example
     * mqq.support("mqq.device.getClientInfo"); // return true | false
     *
     * @support iOS 4.2
     * @support android 4.2
     */
    function supportVersion(name) {

        var support,
            vers,
            arr = name.split('.'),
            shortName = arr[arr.length - 2] + '.' + arr[arr.length - 1];

        support = aSupports[shortName] || aSupports[name.replace('qw.', 'mqq.').replace('qa.', 'mqq.')];

        if (exports.isObject(support)) { // 如果support是个obj，则是旧的情况，要做兼容
            support = support[exports.iOS ? 'iOS' : exports.android ? 'android' : 'browser'];
        }

        if (!support) {
            return false;
        }

        // 增加版本区间检查 20140924
        vers = support.split('-');

        if (vers.length === 1) {
            return exports.compare(vers[0]) > -1;
        } else {
            return exports.compare(vers[0]) > -1 && exports.compare(vers[1]) < 1;
        }

    }

    /*
     * 使用 iframe 发起伪协议请求给客户端
     */
    function openURL(url, ns, method, sn) {
        // Console.debug('openURL: ' + url);
        log({
            from: 'openURL',
            ns: ns || '',
            method: method || '',
            url: url
        });
        var returnValue,
            iframe = document.createElement('iframe');

        iframe.style.cssText = 'display:none;width:0px;height:0px;';

        function failCallback() {

            /*
             正常情况下是不会回调到这里的, 只有客户端没有捕获这个 url 请求,
             浏览器才会发起 iframe 的加载, 但这个 url 实际上是不存在的,
             会触发 404 页面的 onload 事件
             */
            execGlobalCallback(sn, {
                r: -201,
                result: 'error'
            });
        }

        var returnValue;

        var nodeType = exports.android && exports.compare('6.2.0') >= 0 && REGEXP_X5.test(ua) ? 'script' : 'iframe';
        var jsbridgeNode = document.createElement('iframe');
        var removeTimeStamp;
        jsbridgeNode.style.cssText = 'display:none;width:0px;height:0px;';
        jsbridgeNode.onerror = function (e) {
            //在 android 4.0-4.3 中,script节点的src赋值成jsbridge://ui/showDialog的形式会报错
            e.stopPropagation();
        };
        if (exports.iOS) {

            /*
             ios 必须先赋值, 然后 append, 否者连续的 api调用会间隔着失败
             也就是 api1(); api2(); api3(); api4(); 的连续调用,
             只有 api1 和 api3 会真正调用到客户端
             */
            jsbridgeNode.onload = failCallback;
            jsbridgeNode.src = url;
        }

        //201707有时候根元素没有appendChild
        var root = document.body || document.documentElement;
        root.appendChild && root.appendChild(jsbridgeNode);

        /*
         android 这里必须先添加到页面, 然后再绑定 onload 和设置 src
         1. 先设置 src 再 append 到页面, 会导致在接口回调(callback)中嵌套调用 api会失败,
         iframe会直接当成普通url来解析
         2. 先设置onload 在 append , 会导致 iframe 先触发一次 about:blank 的 onload 事件

         */
        if (exports.android) { // android 必须先append 然后赋值
            jsbridgeNode.onload = failCallback;
            jsbridgeNode.src = url;
        }
        if (url.indexOf('mqqapi://') > -1 && exports.android) {
            removeTimeStamp = 0;
        } else {
            removeTimeStamp = 500;
        }
        // android 捕获了iframe的url之后, 也是中断 js 进程的, 所以这里可以用个 setTimeout 0 来删除 iframe
        setTimeout(function () {
            jsbridgeNode && jsbridgeNode.parentNode && jsbridgeNode.parentNode.removeChild(jsbridgeNode);
        }, removeTimeStamp);

        // iOS 可以同步获取返回值, 因为 iframe 的url 被客户端捕获之后, 会挂起 js 进程
        returnValue = exports.__RETURN_VALUE;
        exports.__RETURN_VALUE = undefined;

        return returnValue;
    }


    function isAndroidQQAndRequireCompatible(ns, method) {

        if (exports.platform === 'AndroidQQ') {

            if (exports.compare('4.7.2') < 0) {
                return true;
            }

            if (NEW_PROTOCOL_BACK_LIST[ns] && exports.compare(NEW_PROTOCOL_BACK_LIST[ns]) < 0) {
                return true;
            }

        }

        return false;
    }


    /**
     * @function core.invokeURL
     * @desc mqq 核心方法，用于调用客户端接口。
     * @param {String} url 最终传给终端的url, 不支持回调.
     * @example
     * // 调用普通接口
     * // ios, android
     * mqq.invokeURL("weixin://ns/method");
     *
     * @important 此方法主要在使用手Q外的其它协议时使用
     */
    function invokeURL(url) {
        openURL(url);
    }

    /**
     * @function core.invoke
     * @desc mqq 核心方法，用于调用客户端接口。invoke 封装了两个系统（android、ios）的不同，同时对不同版本进行了兼容。
     * @param {String} namespace 命名空间，每个客户端接口都属于一个命名空间，若不清楚，请咨询对应的客户端开发
     * @param {String} method 接口名字
     * @param {Object} [params] API 调用的参数
     * @param {Function} [callback] API 调用的回调
     * @important 因历史版本的客户实现问题，同一个接口在 android 和 iOS 命名空间和方法名都不一致，同时接口实现的也可能有些许差异，因此尽量使用下面封装好的方法，如：mqq.ui.openUrl。直接调用 invoke 的情况只建议在 android 和 iOS 的实现命名空间和方法以及参数格式都完全一致时使用。
     * @example
     * // 调用普通接口
     * // ios, android
     * mqq.invoke("ns", "method");
     *
     * @example
     * // 调用需要传参数的接口
     * mqq.invoke("ns", "method", {foo: 'bar'});
     *
     * @example
     * // 调用需要传参数且有回调结果的接口
     * mqq.invoke("ns", "method", {foo: 'bar'}, function(data){
     *     console.log(data);
     * });
     *
     *
     * @support iOS 4.2
     * @support android 4.2
     * @support for params iOS 4.5
     * @support for params android 4.7
     */
    function invokeClientMethod(ns, method, params, callback) {

        // 限制iframe里面调用
        if (!ns || !method || window !== window.top) {
            return null;
        }

        var url,
            sn,
            argus,
            result,
            lastParam,
            constCBStr = '__MQQ_CALLBACK_'; // sn 是回调函数的序列号

        argus = SLICE.call(arguments, 2);
        callback = argus.length && argus[argus.length - 1];

        if (exports.isFunction(callback)) { // args最后一个参数是function, 说明存着callback
            argus.pop();
        } else if (exports.isUndefined(callback)) {

            // callback 是undefined的情况, 可能是 api 定义了callback, 但是用户没传 callback, 这时候要把这个 undefined的参数删掉
            argus.pop();
        } else {
            callback = null;
        }
        params = argus[0]; // 一般的接口调用只会有一个参数，这里也只对第一个参数做些特殊处理
        // TODO:以下注释代码需要测试
        // lastParam = argus[argus.length - 1];
        // //调用mqq.callback的方式有如下几种
        // //1.第三个参数直接传mqq.callback(callback)的返回值，为字符串
        // //2.第三个参数传一个对象，对象的callback字段传mqq.callback(callback)的返回值
        // //3.在最后一个参数(不一定是第四个)，直接传入mqq.callback(callback)的返回值
        // if(typeof(params) == 'string' && params.indexOf(constCBStr) == 0){
        //     sn = parseInt(argus[0].replace(constCBStr,''));
        // } else if(exports.isObject(params) && params['callback'] && params['callback'].indexOf(constCBStr) == 0){
        //     sn = parseInt(params['callback'].replace(constCBStr,''));
        // } else if(typeof(lastParam) == 'string' && lastParam.indexOf(constCBStr) == 0){
        //     sn = parseInt(lastParam.replace(constCBStr,''));
        // } else{
        //     //原始逻辑
        //     // 统一生成回调序列号, callback 为空也会返回 sn
        //     sn = storeCallback(callback);
        // }
        sn = storeCallback(callback);

        if (NOT_REPORT_METHOD.indexOf(method) === -1) {

            // 上报 API 调用, openURL 会阻塞 js 线程, 因此要先打点和上报
            reportAPI('jsbridge', ns, method, argus, sn);
        }

        // 如果最后一个参数传了 function, 且 params 里面没有 'callback' 属性的, 把function赋值给params
        // 兼容之后, 任何参数调用都可以直接 mqq.invoke('ns', 'method', params, callback) 了
        // az @ 2015/4/17
        if (callback && exports.isObject(params) && !params['callback']) {
            window['__MQQ_CALLBACK_AUTO_' + sn] = callback;
            params['callback'] = '__MQQ_CALLBACK_AUTO_' + sn;
        }

        if (isAndroidQQAndRequireCompatible(ns, method)) { // android qq 小于 4.7.2的版本需要一些兼容处理

            // 进入到这个分支的，要不版本号小于 4.7.2 ，要不则接口需要用旧协议兼容

            /*
             * Android 4.5 到 4.7.2 支持旧的 jsbridge 协议，4.7.2之后与 ios 进行了统一
             * 三星特供版（ua 里面有_NZ）, 从 4.2.1 拉的分支, 4.2.1 已经去掉了注入到全局对象的方法，但是有支持 jsbridge
             */
            if (exports.compare('4.5') > -1 || /_NZ\b/.test(ua)) {

                // AndroidQQ 且不支持新 jsbridge 协议的版本， 用旧协议拼接
                // 还有部分接口在 4.7.2 还不能使用新协议, 后续版本会修复该问题

                // jsbridge://ns/method/123/test/xxx/yyy
                url = 'jsbridge://' + encodeURIComponent(ns) + '/' + encodeURIComponent(method) + '/' + sn;

                argus.forEach(function (a) {
                    if (exports.isObject(a)) {
                        a = JSON.stringify(a);
                    }

                    url += '/' + encodeURIComponent(String(a));
                });

                openURL(url, ns, method, sn);

            } else { // android 4.5 以下，不支持 jsbridge，但是有注入 java 对象到 js 上下文中
                if (window[ns] && window[ns][method]) {
                    result = window[ns][method].apply(window[ns], argus);
                    if (callback) {

                        fireCallback(sn, [result]);
                    } else {
                        return result;
                    }
                } else if (callback) {
                    fireCallback(sn, [exports.ERROR_NO_SUCH_METHOD]);
                }
            }
        } else { // 剩下的都用新协议

            /*
             android 4.7 以上的支持 ios的协议, 但是客户端的旧接口需要迁移, 4.7赶不上, 需要等到 4.7.2
             jsbridge://ns/method?p=test&p2=xxx&p3=yyy#123
             */
            url = 'jsbridge://' + encodeURIComponent(ns) + '/' + encodeURIComponent(method);

            argus.forEach(function (a, i) {
                if (exports.isObject(a)) {
                    a = JSON.stringify(a);
                }

                if (i === 0) {
                    url += '?p=';
                } else {
                    url += '&p' + i + '=';
                }

                url += encodeURIComponent(String(a));
            });

            // 加上回调序列号
            if (method !== 'pbReport') {

                /*
                 * pbReport 这个接口不能加回调序号, 这个接口本来就不支持回调
                 * 但是 android 的 jsbridge 即使接口没有回调结果, 也会调用一次 js 表示这次接口调用到达了客户端
                 * 同时, 由于 android 一执行 loadUrl('javascript:xxx') 就会导致软键盘收起
                 * 所以上报的时候经常会引发这个问题, 这里就直接不加回调序号了
                 */

                url += '#' + sn;
            }

            result = openURL(url, ns, method);
            if (exports.iOS && result !== undefined && result.result !== undefined) {

                // FIXME 这里可能会导致回调两次, 但是 iOS 4.7.2以前的接口是依靠这里实现异步回调, 因此要验证下
                if (callback) {
                    fireCallback(sn, [result.result]);
                } else {
                    return result.result;
                }
            }
        }

        return null;

    }

    function invoke(ns, method, argus, callback) {
        var func = aFunctions[ns + '.' + method];

        if (exports.isFunction(func)) {

            // 调用参数要去掉ns 和 method
            return func.apply(this, SLICE.call(arguments, 2));
        }

        return invokeClientMethod.apply(this, SLICE.call(arguments));

    }
    /**
     * @function core.invokeSchema
     * @desc 调用手机QQ的原有schema接口，主要用于旧的 schema 接口兼容。
     * @param {String} schema 协议名字
     * @param {String} namespace 命名空间，每个客户端接口都属于一个命名空间，若不清楚，请咨询对应的客户端开发
     * @param {String} method 接口名字
     * @param {Object} [params] API 调用的参数
     * @param {Function} [callback] API 调用的回调
     * @example
     * mqq.invokeSchema("mqqapi", "card", "show_pslcard", { uin: "123456" }, callback);
     *
     * @support iOS 4.2
     * @support android 4.2
     */
    function invokeSchemaMethod(schema, ns, method, params, callback) {
        if (!schema || !ns || !method) {
            return null;
        }

        var argus = SLICE.call(arguments),
            sn,
            url;

        if (exports.isFunction(argus[argus.length - 1])) {
            callback = argus[argus.length - 1];
            argus.pop();
        } else {
            callback = null;
        }

        if (argus.length === 4) {
            params = argus[argus.length - 1];
        } else {
            params = {};
        }

        if (callback) {
            params['callback_type'] = 'javascript';
            sn = createCallbackName(callback);
            params['callback_name'] = sn;
        }

        params['src_type'] = params['src_type'] || 'web';

        if (!params.version) {
            params.version = 1;
        }

        url = schema + '://' + encodeURIComponent(ns) + '/' + encodeURIComponent(method) + '?' + toQuery(params);
        openURL(url, ns, method);

        // 上报 API 调用
        reportAPI(schema, ns, method, argus, sn);
    }

    // ////////////////////////////////// util /////////////////////////////////////////////////
    function mapQuery(uri) {
        var i,
            key,
            value,
            index = uri.indexOf('?'),
            pieces = uri.substring(index + 1).split('&'),
            piece,
            params = {};

        for (i = 0; i < pieces.length; i++) {
            piece = pieces[i];
            index = piece.indexOf('=');
            if (index === -1) { // 只有一个 key的情况
                params[piece] = '';
            } else {
                key = piece.substring(0, index);
                value = piece.substring(index + 1);
                params[key] = decodeURIComponent(value);

            }
        }

        return params;
    }

    function toQuery(obj) {
        var result = [],
            key,
            value;

        for (key in obj) {
            if (obj.hasOwnProperty(key)) {
                key = String(key);
                value = String(obj[key]);
                if (key === '') {
                    result.push(value);
                } else {
                    result.push(key + '=' + encodeURIComponent(value));
                }
            }
        }

        return result.join('&');
    }

    function removeQuery(url, keys) {
        var a = document.createElement('a'),
            obj;

        a.href = url;

        if (a.search) {
            obj = mapQuery(String(a.search).substring(1));
            keys.forEach(function (k) {
                delete obj[k];
            });
            a.search = '?' + toQuery(obj);
        }

        // if (a.hash) {
        //     obj = mapQuery(String(a.hash).substring(1));
        //     keys.forEach(function(k) {
        //         delete obj[k];
        //     });
        //     a.hash = '#' + toQuery(obj);
        // }

        url = a.href;
        a = null;

        return url;
    }

    // ////////////////////////////////// end util /////////////////////////////////////////////////


    // ////////////////////////////////// event /////////////////////////////////////////////////

    /**
     * @function core.addEventListener
     * @desc 监听客户端事件，该事件可能来自客户端业务逻辑，也可能是其他 WebView 使用 dispatchEvent 抛出的事件
     * @param {String} eventName 事件名字
     * @param {Function} handler 事件的回调处理函数
     * @param {Object} handler.data 该事件传递的数据
     * @param {Object} handler.source 事件来源
     * @param {string} handler.source.url 抛出该事件的页面地址
     * @example
     * mqq.addEventListener("hiEvent", function(data, source){
     *     console.log("someone says hi", data, source);
     * })
     *
     * @support iOS 5.0
     * @support android 5.0
     */
    function addEventListener(eventName, handler) {

        if (eventName === 'qbrowserVisibilityChange') {

            // 兼容旧的客户端事件
            document.addEventListener(eventName, handler, false);
            return true;
        }

        var evtKey = 'evt-' + eventName;

        (aCallbacks[evtKey] = aCallbacks[evtKey] || []).push(handler);
        return true;
    }

    /**
     * @function core.removeEventListener
     * @desc 移除客户端事件的监听器
     * @param {String} eventName 事件名字
     * @param {Function} [handler] 事件的回调处理函数，不指定 handler 则删除所有该事件的监听器
     *
     * @support iOS 5.0
     * @support android 5.0
     */
    function removeEventListener(eventName, handler) {
        var evtKey = 'evt-' + eventName,
            handlers = aCallbacks[evtKey],
            flag = false,
            i;

        if (!handlers) {
            return false;
        }

        if (!handler) {
            delete aCallbacks[evtKey];
            return true;
        }

        for (i = handlers.length - 1; i >= 0; i--) {
            if (handler === handlers[i]) {
                handlers.splice(i, 1);
                flag = true;
            }
        }

        return flag;
    }

    // 这个方法时客户端回调页面使用的, 当客户端要触发事件给页面时, 会调用这个方法
    function execEventCallback(eventName /*, data, source*/) {
        var evtKey = 'evt-' + eventName,
            handlers = aCallbacks[evtKey],
            argus = SLICE.call(arguments, 1);

        if (handlers) {
            handlers.forEach(function (handler) {
                fireCallback(handler, argus, false);
            });
        }
    }
    /**
     * @function core.dispatchEvent
     * @desc 抛出一个事件给客户端或者其他 WebView，可以用于 WebView 间通信，或者通知客户端对特殊事件做处理（客户端需要做相应开发）
     * @param {String} eventName 事件名字
     * @param {Object} data 事件传递参数
     * @param {Object} options 事件参数
     * @param {Boolean} options.echo 当前webview是否能收到这个事件，默认为true
     * @param {Boolean} options.broadcast 是否广播模式给其他webview，默认为true
     * @param {Array|String} options.domains 指定能接收到事件的域名，默认只有同域的webview能接收，支持通配符，比如"*.qq.com"匹配所有qq.com和其子域、"*"匹配所有域名。注意当前webview是否能接收到事件只通过echo来控制，这个domains限制的是非当前webview。
     * @example
     * //1. WebView 1(www.qq.com) 监听 hello 事件
     * mqq.addEventListener("hello", function(data, source){
     *    console.log("someone says hi to WebView 1", data, source)
     * });
     * //2. WebView 2(www.tencent.com) 监听 hello 事件
     * mqq.addEventListener("hello", function(data, source){
     *    console.log("someone says hi to WebView 2", data, source)
     * });
     * //3. WebView 2 抛出 hello 事件
     * //不传配置参数，默认只派发给跟当前 WebView 相同域名的页面, 也就是只有 WebView 2能接收到该事件（WebView 1 接收不到事件，因为这两个 WebView 的域名不同域）
     * mqq.dispatchEvent("hello", {name: "abc", gender: 1});
     *
     * //echo 为 false, 即使 WebView 2 的域名在 domains 里也不会收到事件通知, 该调用的结果是 WebView 1 将接收到该事件
     * mqq.dispatchEvent("hello", {name:"alloy", gender:1}, {
     *     //不把事件抛给自己
     *     echo: false,
     *     //广播事件给其他 WebView
     *     broadcast: true,
     *     //必须是这些域名的 WebView 才能收到事件
     *     domains: ["*.qq.com", "*.tencent.com"]
     * });
     *
     * //echo 和 broadcast 都为 false, 此时不会有 WebView 会接收到事件通知, 但是客户端仍会收到事件, 仍然可以对该事件做处理, 具体逻辑可以每个业务自己处理
     * mqq.dispatchEvent("hello", {name:"alloy", gender:1}, {
     *     echo: false,
     *     broadcast: false,
     *     domains: []
     * });
     *
     * @support iOS 5.0
     * @support android 5.0
     */
    function dispatchEvent(eventName, data, options) {

        var params = {
            event: eventName,
            data: data || {},
            options: options || {}
        },
            url;

        if (exports.android && params.options.broadcast === false && exports.compare('5.2') <= 0) {
            // 对 android 的 broadcast 事件进行容错, broadcast 为 false 时,
            // 没有 Webview会接收到该事件, 但客户端依然要能接收
            // 5.2 已经修复该问题
            params.options.domains = ['localhost'];
            params.options.broadcast = true;
        }

        if (exports.platform !== 'browser') { // 浏览器环境不要调用这个接口
            url = 'jsbridge://event/dispatchEvent?p=' + encodeURIComponent(JSON.stringify(params) || '');
            openURL(url, 'event', 'dispatchEvent');

            reportAPI('jsbridge', 'event', 'dispatchEvent');
        }
    }

    /**
     * @event qbrowserTitleBarClick
     * @desc 点击标题栏事件，监听后点击手机QQ标题栏就会收到通知，可以用来实现点击标题滚动到顶部的功能
     * @param {Function} callback 事件回调
     * @param {Object} callback.data 事件参数
     * @param {Object} callback.data.x 点击位置的屏幕x坐标
     * @param {Object} callback.data.y 点击位置的屏幕y坐标
     * @param {Object} callback.source 事件来源
     * @example
     * mqq.addEventListener("qbrowserTitleBarClick", function(data, source){
     *     console.log("Receive event: qbrowserTitleBarClick, data: " + JSON.stringify(data) + ", source: " + JSON.stringify(source));
     * });
     *
     * @support iOS 5.2
     * @support android 5.2
     */

    /**
     * @event qbrowserOptionsButtonClick
     * @desc Android 的物理菜单键的点击事件，点击后会收到通知
     * @param {Function} callback 事件回调
     * @param {Object} callback.data 事件参数
     * @param {Object} callback.source 事件来源
     * @example
     * mqq.addEventListener("qbrowserOptionsButtonClick", function(data, source){
     *     console.log("Receive event: qbrowserOptionsButtonClick, data: " + JSON.stringify(data) + ", source: " + JSON.stringify(source));
     * });
     *
     * @support iOS not support
     * @support android 5.2
     */

    /**
     * @event qbrowserPullDown
     * @desc 页面下拉刷新时候会抛出该事件，主要用于与setPullDown交互，具体可参考setPullDown
     * @example
     * mqq.addEventListener("qbrowserPullDown", function () {
     *     // ... Your Code ...
     * });
     * @note 该事件可配合下拉刷新做交互，具体可参考`setPullDown`
     *
     * @support iOS 5.3
     * @support android 5.3
     */

    /**
     * @event qbrowserVisibilityChange
     * @desc 当webview可见性发生改变时将会抛出该事件
     * @example
     * mqq.addEventListener("qbrowserVisibilityChange", function(e){
     *     console.log(e.hidden);
     * });
     *
     * @support iOS 4.7
     * @support android 4.7
     */


    // ////////////////////////////////// end event /////////////////////////////////////////////////


    // for debug
    exports.__aCallbacks = aCallbacks;
    exports.__aReports = aReports;
    exports.__aSupports = aSupports;
    exports.__aFunctions = aFunctions;

    // for internal use
    exports.__fireCallback = fireCallback;
    exports.__reportAPI = reportAPI;

    // 扩展 exports 对象
    extend(exports, {

        // core
        invoke: invoke,
        invokeClient: invokeClientMethod,
        invokeSchema: invokeSchemaMethod,
        invokeURL: invokeURL,
        build: buildAPI,
        callback: createCallbackName,
        support: supportVersion,
        execGlobalCallback: execGlobalCallback,

        // event
        addEventListener: addEventListener,
        removeEventListener: removeEventListener,
        dispatchEvent: dispatchEvent,
        execEventCallback: execEventCallback,

        // util
        mapQuery: mapQuery,
        toQuery: toQuery,
        removeQuery: removeQuery
    }, true);

    return exports;

});
;// 适配原来的 android jsbridge.js 中定义的接口, ios 没有
// 这个文件是原来的 jsbridge.js 的重新整理, 修复了 jsbridge 跟 mqqapi.js 混用时, jsbridge 的异步接口没有回调的bug
;(function(undefined){
    "use strict";

    var SLICE = Array.prototype.slice;

    //apis map
    var apis0 = {
        /*'mediaPlayerJS':[
            'setDataSource', 'play', 'stop', 'getCurrentPosition', 'getDuration', 'isPlaying'
        ],*/
        'QQApi':[
            //4.1
            'isAppInstalled', 'isAppInstalledBatch', 'startAppWithPkgName',
            //4.2
            'checkAppInstalled', 'checkAppInstalledBatch', 'getOpenidBatch',
            'startAppWithPkgNameAndOpenId'
        ]/*,
        'HtmlViewer':[
            //4.2
            'showHTML'
        ]*/
    };
    var apis45 = {'QQApi':['lauchApp']};
    var apisPA0 = {
        'publicAccount':[
            //4.2
            'close', 'getJson', 'getLocation', 'hideLoading',
            'openInExternalBrowser', 'showLoading', 'viewAccount'
        ]
    };
    var apisPA45 = {
        'publicAccount':[
            //4.3
            'getMemberCount', 'getNetworkState', 'getValue', 'open',
            'openEmoji', 'openUrl', 'setRightButton',
            'setValue', 'shareMessage', 'showDialog'
        ],
        'qqZoneAppList':[
            'getCurrentVersion', 'getSdPath', 'getWebDisplay',
            'goUrl',
            //4.2
            'openMsgCenter', 'showDialog',
            //4.3
            'setAllowCallBackEvent'
        ],
        'q_download':[
            'doDownloadAction', 'getQueryDownloadAction', 'registerDownloadCallBackListener',
            //4.1
            'cancelDownload', 'cancelNotification'//,
            //4.2 这个接口不存在
            //'doGCDownloadAction'
        ],
        'qzone_http':[
            //4.1
            'httpRequest'
        ],
        'qzone_imageCache':[
            'downloadImage', 'getImageRootPath', 'imageIsExist', 'sdIsMounted',
            'updateImage',
            //4.1
            'clearImage'
        ],
        'qzone_app':[
            'getAllDownAppInfo', 'getAppInfo', 'getAppInfoBatch', 'startSystemApp', 'uninstallApp'
        ]
    };
    var apisCoupon = {
        'coupon':[
            'addCoupon', 'addFavourBusiness', 'gotoCoupon', 'gotoCouponHome',
            'isCouponValid', 'isFavourBusiness', 'isFavourCoupon', 'removeFavourBusiness'
        ]
    };

    var ua = navigator.userAgent;

    // var mayHaveNewApi = mqq.__supportAndroidJSBridge;
    // 从core.js迁移过来, core不再存在`__supportAndroidJSBridge`变量
    var mayHaveNewApi = /\bV1_AND_SQI?_([\d\.]+)(.*? QQ\/([\d\.]+))?/.test(ua) && ( mqq.compare('4.5') > -1 || /_NZ\b/.test(ua) );

    var oldApis = {};

    function buildAPI(ns, method, isNewApi){
        if(isNewApi){
            return function(){
                var argus = [ns, method].concat(SLICE.call(arguments));
                mqq.invoke.apply(mqq, argus);
            };
        }else{
            return function(){
                var argus = SLICE.call(arguments);
                var callback = null;
                if(argus.length && typeof argus[argus.length - 1] === 'function'){
                    callback = argus[argus.length - 1];
                    argus.pop();
                }
                var result = oldApis[ns][method].apply(oldApis[ns], argus);
                if(callback){
                    callback(result);
                }else{
                    return result;
                }
            };
        }
        
    }

    function restoreApis(apis, baseLevel){
        baseLevel = baseLevel || 1;
        if(mqq.compare(baseLevel) < 0){ //比较api版本, 如果当前版本太低, 则跳过
            console.info('jsbridge: version not match, apis ignored');
            return;
        }

        for(var objname in apis){
            var methods = apis[objname];
            if(!methods || !methods.length || !Array.isArray(methods)){
                continue;
            }
            var apiObj = window[objname];
            if(!apiObj){
                if(mayHaveNewApi){
                    window[objname] = {};
                }else{
                    continue;
                }
            }else if(typeof apiObj === 'object' && apiObj.getClass){ //detect java object
                oldApis[objname] = apiObj;
                window[objname] = {};
            }
            var oldApi = oldApis[objname];
            apiObj = window[objname];
            for(var i = 0, l = methods.length; i<l; i++){
                var method = methods[i];
                if(apiObj[method]){ //already exist
                    continue;
                }else if(!oldApi){ // wrap a jsbridge function
                    apiObj[method] = buildAPI(objname, method, true);
                }else if(oldApi[method]){ // wrap old api function
                    apiObj[method] = buildAPI(objname, method, false);
                }
            }
        }
    }

    if(!window.JsBridge){
        window.JsBridge = {};
    }
    window.JsBridge.restoreApis = restoreApis;

    restoreApis(apis0);
    restoreApis(apis45, '4.5');
    if(mayHaveNewApi){ //新api有UA标识
        if(/\bPA\b/.test(ua) || mqq.compare('4.6') >= 0){ //公众帐号webview, 4.2开始有, 所有webview, 4.6开始有
            restoreApis(apisPA0);
            restoreApis(apisPA45, '4.5');
            restoreApis(apisCoupon, '4.5');
        }else if(/\bQR\b/.test(ua)){ //二维码webview, 从4.5开始可以打开网页
            restoreApis(apisCoupon, '4.5');
            //4.5二维码webview的publicAccount.openUrl被混淆了,这里hardcode修复一下
            if(mqq.compare('4.5') >=0 && mqq.compare('4.6') < 0){
                window['publicAccount'] = {
                    openUrl:function(url){
                        location.href = url;
                    }
                };
            }
        }
    }else{ //旧版本不能通过UA判断webview, 但能够通过特征检测判断有没有对应api
        restoreApis(apisPA0, '4.2');
    }



})();
;/**
 * @namespace app
 * @desc 应用相关接口
 */

/**
 * @function app.checkAppInstalled
 * @desc 通过packageName(Android)获取本地指定应用的本版号
 *
 * @param {String} identifier 要查询的 identifier。如：Android 微信是 "com.tencent.mm"。
 * @param {Function} callback 回调函数
 * @param {String} callback.result 返回查询结果。正常返回 app 的版本号字符串，若没有查询到则返回 0 字符串
 *
 * @example
 * mqq.app.checkAppInstalled(id, function (ret) {
 *     console.log(ret); // 5.3.1
 * });
 *
 * @support iOS not support
 * @support android 4.2
 * @care 泄露用户本地安装app信息
 */

mqq.build('mqq.app.checkAppInstalled', {
    android: function(identifier, callback){
        mqq.invokeClient('QQApi', 'checkAppInstalled', identifier, callback);
    },
    supportInvoke: true,
    support: {
        android: '4.2'
    }
});
;/**
 * @function app.checkAppInstalledBatch
 * @desc 通过packageName(Android)批量获取本地应用的版本号
 *
 * @param {Array|String} identifiers 要查询的 identifier 数组。如：Android 微信是 "com.tencent.mm"
 * @param {Function} callback 回调函数
 * @param {Array|String} callback.result 返回查询结果。正常返回 app 的版本号字符串，若没有查询到则返回 0 字符串
 *
 * @example
 * mqq.app.checkAppInstalledBatch(["com.tencent.mobileqq", "no.no.no"], function(ret){
 *     console(JSON.stringify(ret)); // ["4.7.1", "0"]
 * });
 *
 * @support iOS not support
 * @support android 4.2
 * @care 泄露用户本地安装app信息
 */

mqq.build('mqq.app.checkAppInstalledBatch', {
    android: function(identifiers, callback){
        identifiers = identifiers.join('|');

        mqq.invokeClient('QQApi', 'checkAppInstalledBatch', identifiers, function (result) {
            result = (result || '').split('|');
            callback(result);
        });
    },
    supportInvoke: true,
    support: {
        android: '4.2'
    }
});


;/**
 * @function app.downloadApp
 * @desc 下载第三方APP
 *
 * @param {Object} params 请求参数
 * @param {String} params.appid 唯一标示，应用中心使用开平appid
 * @param {String} params.url 下载地址，当走手Q下载SDK时使用
 * @param {String} params.packageName 包名
 * @param {String} params.actionCode 操作类型
 * @options for params.actionCode 2 - 下载
 * @options for params.actionCode 3 - 暂停
 * @options for params.actionCode 5 - 安装
 * @options for params.actionCode 12 - 更新
 * @options for params.actionCode 10 - 取消
 *
 * @param {String} params.via 用于上报罗盘
 * @param {String} params.appName 应用名称，用于标题展示
 * @param {Function} callback 进度回调
 * @param {Object} callback.object 回调数据
 * @param {String} callback.object.appid 唯一标示，应用中心使用开平appid
 * @param {Number} callback.object.state 回调状态，取值与 actionCode 一致，整个下载流程如下：下载2 --> 下载中2 --> [暂停3 --> 继续下载2] --> 下载完成4 --> 安装5 --> 安装完成6 --> [卸载完成9]
 * @param {String} callback.object.packagename 包名
 * @param {Number} callback.object.pro 进度
 * @param {Number} callback.object.ismyapp
 * @options for callback.object.ismyapp 0 - 下载sdk 有进度
 * @options for callback.object.ismyapp 1 - 应用宝 无进度
 *
 * @param {String} callback.object.errorMsg 错误内容
 * @param {String} callback.object.errorCode 错误代码
 *
 * @example
 * mqq.app.downloadApp({
 *     "appid": "100686922",
 *     "url": "http://view.inews.qq.com/appDownLoad/322?refer=biznew&src=mQQ&ostype=android&uin=",
 *     "packageName": "com.tencent.news",
 *     "actionCode": "2",
 *     "via": "ANDROIDQQ.TXNEWS",
 *     "appName": "TencentNews",
 * }, function(data){
 *     alert(JSON.stringify(data))
 * });
 * @care 泄露用户本地安装app信息
 *
 * @support iOS 5.9.5
 * @support android 4.5
 */

mqq.build('mqq.app.downloadApp', {
	iOS: (function() {
		return function (params, callback) {
			mqq.invokeClient('app', 'downloadApp', params, callback);
		};
	}()),
	android: (function() {

		// 注册下载进度回调
		// `callsLen`主要为了提高检查`calls`为空的性能
		var calls = {}, callsLen = 0, isRegister;
		// 回调分发器，通过匹配队列中的`appid`与监听器返回的`appid`
		var cmcaller = function (dat) {
			if ( callsLen > 0 ) {
				var i = 0, len = dat.length, item, fn;
				if ( typeof dat === "object" && len ) {
					for ( ; i < len, item = dat[i]; i++ ) {
						if ( fn = calls[item.appid] ) fn(item);
					}
				} else if ( fn = calls[dat.appid] ) {
					fn(dat);
				}
			}
		}

		return function (params, callback) {

			// 不传回调则不注册该监听
			if ( !isRegister && callback ) {
				isRegister = true;
				// 注册全局的监听
				mqq.invokeClient('q_download', 'registerDownloadCallBackListener', mqq.callback(cmcaller));
			}

			// 回调队列
			if ( callback && typeof callback === "function" ) {
				callsLen++;
				calls[params.appid] = callback
			}

			mqq.invokeClient('q_download', 'doDownloadAction', params);
		}
	}()),
    supportInvoke: true,
    support: {
	    ios: '5.9.5',
	    android: '4.5'
    }
});
;/**
 * @function app.isAppInstalled
 * @desc 通过scheme(iOS)或packageName(Android)判断指定应用是否已经安装，注意若是iOS，参数identifier填应用的scheme，android填packageName
 *
 * @param {String} identifier
 * @param {Function} callback 回调函数
 * @param {Boolean} callback.result 返回查询结果。
 *
 * @example
 * //检测手机QQ是否安装
 * var value = "mqq"; //ios
 * //var value = "com.tencent.mobileqq"; //android
 * mqq.app.isAppInstalled(value, function(result){
 *     alert("mobileqq is install: " + result);
 * });
 * @care 泄露用户本地安装app信息
 *
 * @important iOS9新增了scheme白名单限制，如没加手Q LSQpplicationQueriesSchemes白名单(在手Q终端开发工程中添加)，该接口在iOS9上不能正常工作，详情见（https://developer.apple.com/reference/uikit/uiapplication/1622952-canopenurl?language=objcs）。 因此不推荐使用此接口! 建议不检查是否安装, 直接呼起应用替代。
 * @important 如果需要正常检测应用是否安装，必须同时满足以下两个条件：<br> 1、请找终端开发往qqvip-info.plist或qq-info.plist或qqdb-info.plist三个文件中（任选一个）的LSApplicationQueriesSchemes节点添加scheme（必须随手Q版本发布, 且白名单有数量限制，大量的scheme不建议添加）<br> 2、把scheme添加到webview白名单（白名单申请 http://ak.oa.com/whitelist/manage/index.html#/whitelist）
 * @support iOS 4.2
 * @support android 4.2
 */

mqq.build('mqq.app.isAppInstalled', {
    iOS: function(scheme, callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('app', 'isInstalled', {
                'scheme': scheme,
                'callback': mqq.callback(callback)
            });
        }else{
            return mqq.invokeClient('app', 'isInstalled', {
                'scheme': scheme
            }, callback);
        }
    },
    android: function(identifier, callback) {
        mqq.invokeClient('QQApi', 'isAppInstalled', identifier, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.2',
        android: '4.2'
    }
});
;/**
 * @function app.isAppInstalledBatch
 * @desc 批量查询应用是否已安装，原理同上

 * @param {Array|String} identifiers
 * @param {Function} callback 回调函数
 * @param {Array|Boolean} callback.result 返回查询结果。

 * @example
 * mqq.app.isAppInstalledBatch(["mqq", "other_scheme"], function(results){
 *     alert(JSON.stringify(results));
 * });
 * @care 泄露用户本地安装app信息
 *
 * @support iOS 4.2
 * @support android 4.2
 */

mqq.build('mqq.app.isAppInstalledBatch', {
    iOS: function(schemes, callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('app', 'batchIsInstalled', {
                'schemes': schemes,
                'callback': mqq.callback(callback)
            });
        }else{
            return mqq.invokeClient('app', 'batchIsInstalled', {
                'schemes': schemes
            }, callback);
        }
    },
    android: function(identifiers, callback) {
        identifiers = identifiers.join('|');

        mqq.invokeClient('QQApi', 'isAppInstalledBatch', identifiers, function(result) {
            var newResult = [];

            result = (result + '').split('|');
            for (var i = 0; i < result.length; i++) {
                newResult.push(parseInt(result[i]) === 1);
            }

            callback(newResult);
        });
    },
    supportInvoke: true,
    support: {
        iOS: '4.2',
        android: '4.2'
    }
});
;/**
 * @function app.launchApp
 * @desc 使用 schema(iOS) 或者 包名 (android) 启动一个 app
 *
 * @param {String} schema 应用的schema或者包名
 * @param {Object} [params] 参数字面量对象[仅iOS支持]
 *
 * @example
 * mqq.app.launchApp("mqq", {
 *      type: 2
 * }); //iOS
 * mqq.app.launchApp("com.tencent.mobileqq"); //android
 *
 * @care 泄露用户本地安装app信息
 * @support iOS 4.2
 * @support android 4.2
 */

mqq.build('mqq.app.launchApp', {
    iOS: function(schema, params) {
        if (!schema) {
            return;
        }
        //兼容原有的object参数类型
        if (schema && schema.name) {
            params = schema;
            schema = schema.name;
            delete schema.name;
        }

        if (schema.indexOf('://') == -1) {
            schema = schema + '://';
        }

        var url = schema;
        if (params) {
            url = schema + (schema.indexOf('?') > -1 ? '&' : '?') + mqq.toQuery(params);
        }
        mqq.invokeURL(url);
    },
    android: function(schema) {
        //兼容原有的object参数类型
        if (schema && schema.name) {
            schema = schema.name;
        }
        mqq.invokeClient('QQApi', 'startAppWithPkgName', schema);
    },
    supportInvoke: true,
    support: {
        iOS: '4.2',
        android: '4.2'
    }
});
;/**
 * @function app.launchAppWithTokens
 * @desc 启动第三方应用
 *
 * @param {Object} param
 * @param {String} param.appID 应用的ID（qq互联的appid）
 * @param {String} param.paramsStr 约定的要带登录态的串如：pt=$PT$&at=$AT$&openid=$OPID$&pf=$PF$&esk=$ESK$&other=xxx
 * @param {String} param.packageName 安卓特有的值，启动的包名
 * @param {String} param.flags 启动时的 flags，android平台（Android QQ 4.5.2及以上版本）才有
 * @options for param.flags 67108864 (0x04000000) 对应FLAG_ACTIVITY_CLEAR_TOP
 * @options for param.flags 536870912 (0x20000000) 对应FLAG_ACTIVITY_SINGLE_TOP
 * @options for param.flags 4194304 (0x00400000) 对应FLAG_ACTIVITY_BROUGHT_TO_FRONT
 * @param {String} [param.type] type
 *
 * @example
 * mqq.app.launchAppWithTokens({
 *     appID: "123456",
 *     paramsStr: "openid=$OPID$",
 *     flag:"67108864", //android 必须
 *     type: "wtlogin"
 * });
 * // app端接收参数的方法:
 * //  1. 当type为wtlogin, 并且app使用的sdk支持tencentwtloginXXXXX://协议, 登录将由sdk完成, app取不到paramsStr里面的参数
 * //  2. 其它情况
 * // 在你的app入口{@link http://developer.android.com/reference/android/content/pm/PackageManager.html#getLaunchIntentForPackage(java.lang.String)}
 * // getIntent().getStringExtra("param1");
 * // getIntent().getStringExtra("param2");
 *
 * @care 泄露用户本地安装app信息
 * @support iOS 4.6
 * @support android 4.6
 */
mqq.build('mqq.app.launchAppWithTokens', {
    iOS: function(params, paramsStr) {
        //判断参数是4.6的接口样式
        if (typeof params === 'object') {
            return mqq.invokeClient('app', 'launchApp', params);
        }
        //判断参数是4.5的接口样式
        return mqq.invokeClient('app', 'launchApp', {
            'appID': params,
            'paramsStr': paramsStr
        });
    },
    android: function(params) {
        if (mqq.compare('5.2') >= 0) {
            mqq.invokeClient('QQApi', 'launchAppWithTokens', params);
        } else if (mqq.compare('4.6') >= 0) {
            mqq.invokeClient('QQApi', 'launchAppWithTokens', params.appID,
                params.paramsStr, params.packageName, params.flags || params.falgs || 0);
        } else {
            mqq.invokeClient('QQApi', 'launchApp', params.appID,
                params.paramsStr, params.packageName);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function app.sendFunnyFace
 * @desc 发送趣味表情
 *
 * @param {Object} param
 * @param {String} param.type 业务类型，一起玩为funnyFace
 * @param {Number} param.sessionType 会话类型
 * @options for param.sessionType 1 - 群
 * @options for param.sessionType 2 - 讨论组
 * @options for param.sessionType 3 - C2C聊天
 *
 * @param {Number} param.gcode 会话ID，针对群，这里是外部可见的群号
 * @param {Number} param.guin 针对群，这里是内部群号。讨论组和C2C类型这里指定为0
 * @param {Number} param.faceID 标识特定表情，到connect.qq.com上申请
 *
 * @example
 * mqq.app.sendFunnyFace({
 *     type: "funnyFace",
 *     sessionType: 1,
 *     guin: 123456,
 *     faceID: 123456
 * });
 *
 * @support iOS 4.6
 * @support android 4.6
 * @discard 1
 */

mqq.build('mqq.app.sendFunnyFace', {
    iOS: function(params) {
        mqq.invokeClient('app', 'sendFunnyFace', params);
    },
    android: function(params) {
        mqq.invokeClient('qbizApi', 'sendFunnyFace', params.type, params.sessionType,
            params.gcode, params.guin, params.faceID);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @namespace coupon
 * @desc 优惠券相关接口
 * @ignore 1
 */

/**
 * @function coupon.addCoupon
 * @desc 领取优惠券
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 * @param {Number} param.cid 优惠券ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.coupon.addCoupon', {
    iOS: function(bid, cid, sourceId, city, callback) {
        if (typeof bid === 'object') { // 4.6
            var params = bid;
            // cid（第二个参数）是callback
            if (params.callback = mqq.callback(cid)) {
                mqq.invokeClient('coupon', 'addCoupon', params);
            }
        } else { // 兼容4.5
            if (typeof city === 'function') {
                callback = city;
                city = '';
            }
            mqq.invokeClient('coupon', 'addCoupon', {
                'bid': bid,
                'cid': cid,
                'sourceId': sourceId,
                'city': city || '',
                'callback': mqq.callback(callback)
            });
        }
    },
    android: function(params, callback) {
        var name = mqq.callback(callback, true);
        mqq.invokeClient('coupon', 'addCoupon', params.bid, params.sourceId,
            params.cid, name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function coupon.addFavourBusiness
 * @desc 收藏商家
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */
mqq.build('mqq.coupon.addFavourBusiness', {
    iOS: function(bid, sourceId, callback) {
        //4.6
        if (typeof bid === 'object') {
            var params = bid;
            //sourceId（第二个参数）是callback
            if (params.callback = mqq.callback(sourceId)) {
                mqq.invokeClient('coupon', 'addFavourBusiness', params);
            }
        }
        //兼容4.5
        else {
            mqq.invokeClient('coupon', 'addFavourBusiness', {
                'bid': bid,
                'sourceId': sourceId,
                'callback': mqq.callback(callback)
            });
        }
    },
    android: function(params, callback) {
        var name = mqq.callback(callback, true);
        mqq.invokeClient('coupon', 'addFavourBusiness', params.bid, params.sourceId,
            name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function coupon.goToCouponHomePage
 * @desc 跳转到优惠券首页
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 *
 * @param {Function} callback 回调函数
 * @param {Number} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.coupon.goToCouponHomePage', {
    iOS: function(params) {
        mqq.invokeClient('coupon', 'goToCouponHomePage', {
            'params': params
        });
    },
    android: function(params) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('coupon', 'goToCouponHomePage', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function coupon.isFavourBusiness
 * @desc 判断是否我收藏的商家
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.coupon.isFavourBusiness', {
    iOS: function(bid, sourceId, callback) {
        //4.6
        if (typeof bid === 'object') {
            var params = bid;
            //sourceId（第二个参数）是callback
            if (params.callback = mqq.callback(sourceId)) {
                mqq.invokeClient('coupon', 'isFavourBusiness', params);
            }
        }
        //兼容4.5
        else {
            mqq.invokeClient('coupon', 'isFavourBusiness', {
                'bid': bid,
                'sourceId': sourceId,
                'callback': mqq.callback(callback)
            });
        }
    },
    android: function(params, callback) {
        mqq.invokeClient('coupon', 'isFavourBusiness', params.bid, params.sourceId,
            callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function coupon.isFavourCoupon
 * @desc 判断指定的优惠券是否已收藏
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 * @param {Number} param.cid 优惠券ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.coupon.isFavourCoupon', {
    iOS: function(bid, cid, sourceId, callback) {
        //4.6
        if (typeof bid === 'object') {
            var params = bid;
            //cid（第二个参数）是callback
            if (params.callback = mqq.callback(cid)) {
                mqq.invokeClient('coupon', 'isFavourCoupon', params);
            }
        }
        //兼容4.5
        else {
            mqq.invokeClient('coupon', 'isFavourCoupon', {
                'bid': bid,
                'cid': cid,
                'sourceId': sourceId,
                'callback': mqq.callback(callback)
            });
        }
    },
    android: function(params, callback) {
        mqq.invokeClient('coupon', 'isFavourCoupon', params.bid, params.cid,
            params.sourceId, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function coupon.removeCoupon
 * @desc 删除优惠券
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 * @param {Number} param.cid 优惠券ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android not support
 */

mqq.build('mqq.coupon.removeCoupon', {
    iOS: function(bid, cid, sourceId, callback) {
        //4.6
        if (typeof bid === 'object') {
            var params = bid;
            //cid（第二个参数）是callback
            if (params.callback = mqq.callback(cid)) {
                mqq.invokeClient('coupon', 'removeCoupon', params);
            }
        }
        //兼容4.5
        else {
            mqq.invokeClient('coupon', 'removeCoupon', {
                'bid': bid,
                'cid': cid,
                'sourceId': sourceId,
                'callback': mqq.callback(callback)
            });
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6'
    }
});
;/**
 * @function coupon.removeFavourBusiness
 * @desc 删除收藏商家
 *
 * @param {Object} param
 * @param {Number} param.bid 商家的ID
 * @param {Number} param.sourceId 商户来源ID
 *
 * @param {Function} callback 回调函数
 * @param {Function} callback.retCode 返回状态
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.coupon.removeFavourBusiness', {
    iOS: function(bid, sourceId, callback) {
        //4.6
        if (typeof bid === 'object') {
            var params = bid;
            //sourceId（第二个参数）是callback
            if (params.callback = mqq.callback(sourceId)) {
                mqq.invokeClient('coupon', 'removeFavourBusiness', params);
            }
        }
        //兼容旧接口
        else {
            mqq.invokeClient('coupon', 'removeFavourBusiness', {
                'bid': bid,
                'sourceId': sourceId,
                'callback': mqq.callback(callback)
            });
        }
    },
    android: function(params, callback) {
        var name = mqq.callback(callback, true);
        mqq.invokeClient('coupon', 'removeFavourBusiness', params.bid, params.sourceId,
            name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @namespace data
 * @desc 本地和远程数据接口
 */

/**
 * @function data.batchFetchOpenID
 * @desc 批量查询指定appid的openid，每次最多只能传入5个appid（CGI限制）
 *
 * @param {Object} param
 * @param {Array|Number} param.appIDs
 * @param {Function} callback 回调函数
 * @param {Object} callback.result 返回数据具体格式请参考demo
 *
 * @example
 * mqq.data.batchFetchOpenID({
 *     appIDs: [123, 456, 789]
 * }, function(result){
 *     alert("result: " + result);
 * });
 * // CGI返回的responseText数据格式如下：
 * {
 *     "ret":0,
 *     "data": [
 *         {"openid":"...", "appid":"..."},
 *         {...},
 *         ...
 *     ]
 * }
 *
 * @support iOS 4.5
 * @support android 4.6
 * @discard 1
 */
mqq.build('mqq.data.batchFetchOpenID', {

    iOS: function(opt, callback) {
        var appIDs = opt.appIDs;

        mqq.data.fetchJson({
            url: 'http://cgi.connect.qq.com/api/get_openids_by_appids',
            params: {
                'appids': JSON.stringify(appIDs)
            }
        }, callback);
    },
    android: function(opt, callback) {
        var appIDs = opt.appIDs;

        mqq.data.fetchJson({
            url: 'http://cgi.connect.qq.com/api/get_openids_by_appids',
            params: {
                'appids': JSON.stringify(appIDs)
            }
        }, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});
;/**
 * @function data.deleteH5Data
 * @desc 删除本地数据
 *
 * @param {Object} param
 * @param {String} param.callid 用来标示请求id, 返回时把该值传回
 * @param {String} param.host 如果host不为空, 且是该页面的域名的父域名, 则往host写, 如果为空则往页面的域名写, 其他为错误
 * @param {String} param.path 区分业务, 为空则报错
 * @param {String} param.key 数据对应的key, 如果为空则删除整个path
 * @param {Function} callback
 * @param {Object} callback.param
 * @param {Number} callback.param.ret 状态返回码
 * @options for callback.param.ret 0: 操作成功
 * @options for callback.param.ret -2: JSON数据格式有误
 * @options for callback.param.ret -3: 参数不能为空
 * @options for callback.param.ret -5: 没有权限操作该域的数据
 * @options for callback.param.ret -6: path不能为空
 * @options for callback.param.ret -7: key不能为空
 * @options for callback.param.ret -8: data不能为空
 * @options for callback.param.ret -9: 空间不足或不存在SD卡
 * @options for callback.param.ret -11: 读取不到任何数据
 * @options for callback.param.ret -12: 写入数据量过大
 * @param {Object} callback.param.response 返回值，例如{callid:"2"}
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.deleteH5Data', {
    iOS: function(params, callback) {

        // callback 默认要有，否则ios会导致手Q闪退
        var callbackName = mqq.callback(callback||function() {});
        mqq.invokeClient('data', 'deleteWebviewBizData', {
            'callback': callbackName,
            'params': params
        });
    },
    android: function(params, callback) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('publicAccount', 'deleteH5Data', params,
            mqq.callback(callback, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.deleteH5DataByHost
 * @desc 删除指定域下的所有数据
 *
 * @param {Object} param
 * @param {String} param.callid 用来标示请求id, 返回时把该值传回
 * @param {String} param.host 如果host不为空, 且是该页面的域名的父域名, 则往host写, 如果为空则往页面的域名写, 其他为错误
 * @param {Function} callback
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.deleteH5DataByHost', {
    iOS: function(params, callback) {
        var callbackName = callback ? mqq.callback(callback) : null;
        mqq.invokeClient('data', 'deleteWebviewBizData', {
            'callback': callbackName,
            'delallhostdata': 1,
            'params': params
        });
    },
    android: function(params, callback) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('publicAccount', 'deleteH5DataByHost', params,
            mqq.callback(callback, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.fetchJson
 * @desc 发送请求到指定url拉取JSON数据，若url是qq域的，客户端会自动种上uin和vkey到cookie里
 *
 * @param {Object} param
 * @param {String} param.url
 * @param {Object} param.params 请求参数
 * @param {Object} param.options 请求配置
 * @param {Object} param.options.method 请求方式
 * @options for param.options.method GET
 * @options for param.options.method POST
 * @default for param.options.method GET
 * @param {Number} param.options.timeout 请求超时时间（秒），客户端请求默认超时时间为60s
 * @param {Object} param.context 保存上下文的JSON Object，会原样传回到callback函数里
 * @param {Function} callback
 * @param {String} callback.responseText 返回内容
 * @param {Object} callback.context
 * @param {Number} callback.statusCode statusCode 若请求失败，statusCode=0，responseText=错误原因描述; 否则statusCode=200
 *
 * @example
 * mqq.data.fetchJson({
 *     url: "http://s.web2.qq.com/api/getvfwebqq",
 *     params: {},
 *     options: {
 *         method: "GET"
 *     }
 * }, function(responseText, context, statusCode){
 *     alert("result: " + statusCode + " " + responseText);
 * });
 * @care 会带cookie去访问指定QQ域URL，可被利用于构造CSRF漏洞
 *
 * @support iOS 4.5
 * @support android 4.6
 */
(function() {


    // fetchJson 的回调
    var requestMap = {};
    var UUIDSeed = 1;

    function createUUID() {
        return 'UID_' + (++UUIDSeed);
    }

    // 这个全局回调是 for android的
    window['clientCallback'] = function(result, callbackToken) {
        // alert('callback: ' + result + '\n token: ' + callbackToken)
        var options = requestMap[callbackToken];
        if (!options) {
            console.log('this getJson no callbackToken!');
            return;
        }
        if (options.callback) {
            clearTimeout(options.timer);
            if (typeof result === 'string') {
                try {
                    result = JSON.parse(result);
                } catch (e) {
                    result = null;
                }
            }
            options.callback(result, options.context || window, 200);
            options.callback = null;
        }
    };

    mqq.build('mqq.data.fetchJson', {
        iOS: function(opt, callback) {
            var url = opt.url,
                params = opt.params || {},
                options = opt.options || {},
                context = opt.context;
            //query parameters
            params['_t'] = +new Date();

            //callback function
            var callbackName = callback ? mqq.callback(function(result, ctx, statusCode) {
                if (typeof result === 'string') {
                    try {
                        result = JSON.parse(result);
                    } catch (e) {
                        result = null;
                    }
                }
                callback(result, ctx, statusCode);
            }, true /*deleteOnExec*/) : null;
            //send request to url via client
            mqq.invokeClient('data', 'fetchJson', {
                'method': options['method'] || 'GET',
                'timeout': options['timeout'] || -1,
                'options': options,
                'url': url,
                'params': mqq.toQuery(params),
                'callback': callbackName,
                'context': JSON.stringify(context)
            });
        },
        android: function(opt, callback) {

            var options = opt.options || {};
            var method = options.method || 'GET';
            var strParams = {
                param: opt.params,
                method: method
            };
            strParams = JSON.stringify(strParams);

            var callbackToken = createUUID();
            // alert(strParams + '\n' +callbackToken);
            opt.callback = callback;
            requestMap[callbackToken] = opt;
            if (options.timeout) {
                opt.timer = setTimeout(function() {
                    if (opt.callback) {
                        opt.callback('timeout', opt.context || window, 0);
                        opt.callback = null;
                    }
                }, options.timeout);
            }
            mqq.invokeClient('publicAccount', 'getJson', opt.url,
                strParams, '', callbackToken);
        },
        supportInvoke: true,
    support: {
            iOS: '4.5',
            android: '4.6'
        }
    });
})();
;/**
 * @function data.getClipboard
 * @desc 读取剪贴板的内容
 *
 * @param {Function} callback
 * @param {String} callback.result 剪贴板中的内容，目前仅支持读取文本
 *
 * @support iOS 4.7.2
 * @support android 4.7.2
 */
mqq.build('mqq.data.getClipboard', {
    iOS: function(callback) {
        var params = {};
        if(mqq.__isWKWebView){
            mqq.invokeClient('data', 'getClipboard', {callback: mqq.callback(callback)});
        }else{
            var result = mqq.invokeClient('data', 'getClipboard', params);
            callback && callback(result);
        }
    },
    android: function(callback) {
        var params = {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('data', 'getClipboard', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '4.7.2'
    }
});
;/**
 * @function data.getFriendInfo
 * @desc 打开终端的好友选择器、通讯录选择器或群选择器。选择后返回选择的信息
 *
 * @param {Object} param 参数对象
 * @param {String} param.title 好友选择界面的标题
 * @param {Number} param.type 好友选择类型
 * @options for param.type 1=打开选择QQ好友界面；
 * @options for param.type 16=打开选择通讯录好友界面；
 * @options for param.type 16=打开选择通讯录好友界面；
 * @options for param.type 17=打开选择QQ好友和通讯录好友的界面；
 * @param {Boolean} param.isMulti 是否选择多个
 * @options for param.isMulti true=选择多个；
 * @options for param.isMulti false=选择单个；
 * @support for param.isMulti iOS 5.8
 * @support for param.isMulti android 5.8
 * @param {Number} param.limitNum 最多选择多少个，在isMulti=true时有效
 * @support for param.limitNum iOS 5.8
 * @support for param.limitNum android 5.8
 *
 * @param {Function} callback 回调函数
 * @param {Array} callback.result 选择的好友列表，下面是数组中单个对象的属性列表
 * @param {String} callback.result.name 昵称
 * @param {String} callback.result.uin QQ号码。当从通讯录选择时，该值可能为空
 * @param {String} callback.result.phone 电话号码。当从QQ好友选择时，该值为空
 *
 * @example
 * mqq.data.getFriendInfo({
 *         title: 'QQ好友选择器',
 *         type: 1
 *     }, function (ret) {
 *     // [{uin:"5201313", phone: "18696969696", name: "小情人"}]
 *     console.log(JSON.stringify(ret));
 * });
 * @care 可能导致用户好友与手机号码泄露（需要用户交互）
 *
 * @support iOS 5.1
 * @support android 5.1
 */

;(function () {
    // 客户端返回的数据：{friends:[{uin:"5201313", phone: "18696969696", name: "小情人"}]}
    var _wrapCallback = function (type,callback) {
        return function (responseData) {
            // 页面的回调函数只返回 friends 数据，过滤 result、msg 等信息
            // 终端正常返回(result=0)才会返回 IP 地址列表，其他情况都返回空数组
            if(type ==1 || type ==16 || type ==17){
                callback(responseData['friends'] || []);
            }else{
                callback(responseData || {});      //拓展拉取群的场景，去掉了获取friends属性返回的逻辑
            }
        }
    };

    var _handler = function (params, callback) {
        if (callback) {
            params.callback = mqq.callback(_wrapCallback(params.type,callback));
        }
        mqq.invokeClient('qw_data', 'getFriendInfo', params);
    };

    mqq.build('mqq.data.getFriendInfo', {
        iOS: _handler,
        android: _handler,
        supportInvoke: true,
    support: {
            iOS: '5.1.0',
            android: '5.1.0'
        }
    });

})();
;/**
 * @function data.getFriendRemark
 * @desc 通过QQ号码获取QQ好友的备注信息
 *
 * @param {Object} param 参数对象
 * @param {Array} param.uins 要获取的QQ号码的字符串列表，例如["10001","10002"]
 *
 * @param {Function} callback 回调函数
 * @param {Object} callback.result 返回的备注信息，结构为：{"qq号":"我是备注"}，例如{"10000":"Q哥","10001":"Q妹"}
 *
 * @example
 * mqq.data.getFriendRemark({uins:["10001","10002"]}, function (ret) {
 *     // {"10001":"Q哥","10002":"Q妹"}
 *     console.log(JSON.stringify(ret));
 * });
 *
 * @care 可获取好友备注
 * @support iOS 5.8.0
 * @support android 5.8.0
 */

;(function () {

    // 客户端返回的数据：{remarks:{"1001":"remarkname"}}
    var _wrapCallback = function (callback) {
        return function (responseData) {
            var remarks = {};
            if(responseData && responseData['remarks']) {
                remarks = responseData['remarks'];
            }
            callback(remarks);
        }
    };

    var _handler = function (params, callback) {
        if (callback) {
            params.callback = mqq.callback(_wrapCallback(callback), false /*deleteOnExec*/ , true /*execOnNewThread*/);
        }
        mqq.invoke('qw_data', 'getFriendRemark', params);
    };

    mqq.build('mqq.data.getFriendRemark', {
        iOS: _handler,
        android: _handler,
        supportInvoke: true,
    support: {
            iOS: '5.8.0',
            android: '5.8.0'
        }
    });

})();
;/**
 * @function data.getPageLoadStamp
 * @desc 返回【创建 WebView 】到 【 WebView 开始加载url】间的时间点，因为 WebView 创建之后还要做一堆处理，中间是需要耗时的，这段耗时单纯 Web 无法统计
 *
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {Number} callback.result.ret 返回码，0为成功
 * @param {Number} callback.result.onCreateTime 开始创建 WebView 的时间戳
 * @param {Number} callback.result.startLoadUrlTime 开始加载 url 的时间戳
 * @param {String} callback.result.url WebView 最初加载的 url
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.getPageLoadStamp', {
    iOS: function(callback) {

        mqq.invokeClient('data', 'getPageLoadStamp', {
            callback: mqq.callback(callback)
        });
    },
    android: function(callback) {

        mqq.invokeClient('publicAccount', 'getPageLoadStamp', mqq.callback(callback));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.getPerformance
 * @desc 获取 Performance 数据。在统一 WebView 中要在 v4.7.1 才支持。低于 v4.7.1 的建议用非统一 WebView 的接口。
 *
 * @param {Function} callback 回调函数
 * @param {Number} callback.result 返回码。-1：错误，0：成功；
 * @param {String} callback.message 具体错误信息；
 * @param {Object} callback.data 数据对象；
 * @param {Number} callback.data.clickStart 单击按钮的瞬间时间戳，单位毫秒；
 * @param {Number} callback.data.pageStart Web 页面开始加载的时间戳，单位毫秒；
 * @param {Number} callback.data.pageFinish Web 页面完成加载的时间戳，单位毫秒；
 *
 * @example
 * mqq.data.getPerformance(function (ret) {
 *     console.log(JSON.stringify(ret)); // 4.7.2.243
 * });
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */

;(function () {
    // 修复 android 5.0 下正常返回的数据和预期的不一样的问题，iOS是正常的
    // 预期值：{result: 0, message: '成功', {clickStart:'1408351124790',pageStart:'1408351144799',pageFinish:'1408351160044'}}
    // 实际值：{clickStart:'1408351124790',pageStart:'1408351144799',pageFinish:'1408351160044'}
    var _wrapCallback = function (callback) {
        return function (responseData) {
            if(mqq.android && responseData && responseData.result === undefined) {
                try {
                    responseData = JSON.parse(responseData);
                } catch (error) {}

                responseData = {
                    result: 0,
                    data: responseData,
                    message: '成功'
                };
            }
            callback(responseData);
        }
    };

    var _handler = function (callback) {
        if (mqq.compare('4.7.1') >= 0) {
            mqq.invokeClient('qw_data', 'getPerformance', _wrapCallback(callback));
        } else {
            try {
                common.getPerformance(_wrapCallback(callback));
            } catch (error) {
                callback({"result": -1, "message": "该接口在手Q v4.7.1 或以上才支持！", "data": null});
            }
        }
    };

    mqq.build('mqq.data.getPerformance', {
        iOS: _handler,
        android: _handler,
        supportInvoke: true,
    support: {
            iOS: '4.7.1',
            android: '4.7.1'
        }
    });

})();
;/**
 * @function data.getUrlImage
 * @desc 下载指定图片, 以base64的形式返回
 *
 * @param {Object} param
 * @param {String} param.callid 用来标示请求id, 返回时把该值传回
 * @param {String} param.url 图片的url, 必填
 * @param {Function} callback
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.getUrlImage', {
    iOS: function(params, callback) {

        var callbackName = callback ? mqq.callback(callback) : null;
        mqq.invokeClient('data', 'getUrlImage', {
            'callback': callbackName,
            'params': params
        });
    },
    android: function(params, callback) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('publicAccount', 'getUrlImage', params,
            mqq.callback(callback));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.getUserInfo
 * @desc 获取用户信息，包括：uin，skey，vkey，可以获取到的 skey 是一定有效的。同时，调用该接口后会刷新 cookie，自动更新 skey。
 *
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {String} callback.result.uin 用户UIN
 * @param {String} callback.result.nick 用户昵称
 * @support for callback.result.nick iOS 5.3.2
 * @support for callback.result.nick android 5.3.2
 * @param {String} callback.result.skey
 * @important {String} callback.result.vkey 此参数于6.6.0版本废弃
 * @param {String} callback.result.sid
 *
 * @support iOS 4.7
 * @support android 4.7
 *
 * @care 可获取用户资料与cookie
 * @note 必须是在登陆态白名单的页面，调用该接口时 `skey`, `vkey`, `sid` 才有数据返回。关于登陆态，可查阅：<a href="http://ak.oa.com/mobile/ptlogin.html" target="_blank">http://ak.oa.com/mobile/ptlogin.html</a>。传送门：<a href="http://mqq.oa.com/faq.html#Q5" target="_blank">我的页面是否能获取登录态？</a>
 * @important 务必仅在需要刷新登录态的时候才调用，在4.7.x版本频繁调用此接口可能会触发后台限频机制，两次调用之间需要延时1s。
 */
mqq.build('mqq.data.getUserInfo', {
    iOS: function(callback) {

        return mqq.invokeClient('data', 'userInfo', callback);
    },
    android: function(callback) {
        mqq.invokeClient('data', 'userInfo', {
            callback: mqq.callback(callback)
        });
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function data.getWebRunEnv
 * @desc 用于web业务获取入口AIO的信息，例如从好友聊天窗口点击业务连接进入该业务，那可以通过该接口获取聊天窗口的用户信息
 *
 * @param {Function} callback 回调
 * @param {Object} callback.params 返回数据
 * @param {String} callback.params.user_uin 点击进去webview的当前用户uin
 * @param {String} callback.params.group_uin 群uin，如果是好友聊天窗口，则该字段为空
 * @param {String} callback.params.msg_sender_uin 消息发送者uin
 * @param {String} callback.params.env_type AIO类型
 * @options for callback.params.env_type group-群聊天窗口
 * @options for callback.params.env_type friend-好友聊天窗口
 * @options for callback.params.env_type discussGroup-讨论组聊天窗口
 *
 * @support iOS 5.7
 * @support android 6.0
 */
mqq.build('mqq.data.getWebRunEnv', {
    iOS: function(callback) {
        mqq.invokeClient('data', 'getWebviewRunningEnvironment', {
            callback: mqq.callback(callback)
        });
    },
    android: function(callback) {
        mqq.invokeClient('data', 'getWebviewRunningEnvironment', {
            callback: mqq.callback(callback)
        });
    },
    supportInvoke: true,
    support: {
        iOS: '5.7',
        android: '6.0'
    }
});
;/**
 * @function data.isFollowUin
 * @desc 检查用户是否已关注该公众账号
 *
 * @param {Object} param
 * @param {String} param.uin 公众账号的uin
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {Number} callback.result.ret 0：调用成功；其他值：调用失败
 * @param {Object} callback.result.response { "follow": true }
 *
 * @example
 * mqq.data.isFollowUin({ uin: "2010741172" }, function(result) {
 *     alert(JSON.stringify(result));
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 *
 * @note Android QQ（4.7.2及以前版本） 的该方法只能在公众账号AIO和生活优惠中打开的页面中调用
 * @important 该接口5.4.0存在bug导致无法正常返回状态，5.4.1会进行修复
 */
mqq.build('mqq.data.isFollowUin', {
    iOS: function(params, callback) {
        params.callback = mqq.callback(callback);
        mqq.invokeClient('data', 'isFollowUin', params);
    },
    android: function(params, callback) {
        mqq.invokeClient('publicAccount', 'isFollowUin', params, mqq.callback(callback));
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function data.onFirstScreen
 * @desc 监听页面首屏可见事件，获取页面首屏可见时间。（该事件仅触发一次，需要在事件触发前添加监听）
 *
 * @param {Function} callback 回调函数
 * @param {Object} callback.result 返回的时间信息
 * @param {Number} callback.result.code，0表示获取成功，其他为错误
 * @param {Number} callback.result.time，首屏可见时间，单位为毫秒
 *
 * @example
 * mqq.data.onFirstScreen(function (ret) {
 *     // {"code":0,"time":1050}
 *     console.log(JSON.stringify(ret));
 * });
 *
 * @support android 5.4.0
 */

;(function () {
    var subscribeList = {},
        isInited,
        canUsed = typeof(tbs_bridge) == "object" && typeof tbs_bridge.nativeExec == "function",
        x5_bridge = canUsed ? tbs_bridge : null,
        fnEmpty = function(){};

    var doSubscribe = function (eventName) {
        if(!subscribeList[eventName] && canUsed){
            x5_bridge.nativeExec("debug","subscribeChanged",1, '{\"numHandlers\":1,\"type\":\"'+eventName+'\"}');
            subscribeList[eventName] = [];
        }
    };
    var bindEvent = function(eventName,callback){
        var slEvent = subscribeList[eventName];
        if(slEvent){
            slEvent.push(callback);
        }
        if(!isInited && canUsed){
            x5_bridge.fireEvent = function(type, params) {
                var i,ilen;
                type = type || "";
                var slEvent = subscribeList[type];
                if(slEvent && slEvent.length>0){
                    for(i=0,ilen = slEvent.length;i<ilen;i++){
                        slEvent[i](params);
                    }
                    //去掉该事件监听
                    subscribeList[type] = [];
                }
            };
            isInited = true;
        }
    };

    var _wrapCallback = function (callback){
        var f;
        if(typeof callback ==="function"){
            f = function(params){
                var _code = -1,_time = 0;
                if(typeof params ==="string"){
                    params = JSON.parse(params);
                }
                if(typeof params ==="object"){
                    if(params.value){
                        _code = 0;
                        _time = parseInt(params.value);
                        _time = _time ? _time : 0;

                    }
                }
                callback && callback({code:_code,time:_time})
            };
        }
        else{
            f = fnEmpty;
        }
        return f;
    };


    var _handler = function (callback) {
        if(!canUsed){
            return;
        }
        doSubscribe("onfirstscreen");
        bindEvent("onfirstscreen",_wrapCallback(callback));
    };

    mqq.build('mqq.data.onFirstScreen', {
        android: _handler,
        support: {
            android: '5.4.0'
        }
    });

})();
;/**
 * @function data.pbReport
 * @desc 客户端的上报接口，走sso通道，上报到后台根据 type 进行分发，type 需要跟后台约定，可以联系 winstontang kennyang。具体上报字段请查看相关上报的文档。
 *
 * @param {String} type 上报的类型
 * @options for type 10004 MM 上报(mm.isd.com)
 * @options for type 103 Monitor 上报(monitor.server.com)
 * @options for type 104 返回码 上报(m.isd.com)
 * @options for type 10000~100000 TDW 上报，每个 type 对应一个表，需要跟 winstontang kennyang 确认
 * @param {String} data 上报的数据，不同的类型有不一样的格式
 *
 * @example
 * //MM 上报
 * mqq.data.pbReport(10004, "appid={{appid}}&releaseversion={{releaseversion}}&xxxx")
 *
 * // Monitor 上报
 * mqq.data.pbReport(103, "34512,23412,334565")
 *
 * // 返回码 上报
 * mqq.data.pbReport(104, '{"d":"业务数据","h":"当前页面host","ua":"浏览器user agent"}')
 *
 * // TDW 上报
 * mqq.data.pbReport(type, "uin=1000&name=aaa&xxxx")
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.pbReport', {
    iOS: function(type, data) {
        // 客户端已经废弃了这个接口
        // mqq.invokeClient('data', 'pbReport', {
        //     'type': String(type),
        //     'data': data
        // });
    },
    android: function(type, data) {
        // 客户端已经废弃了这个接口
        // mqq.invokeClient('publicAccount', 'pbReport', String(type), data);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.readH5Data
 * @desc 读取存到本地的数据
 *
 * @param {Object} param
 * @param {String} param.callid 用来标示请求id, 返回时把该值传回
 * @param {String} param.host 如果host不为空, 且是该页面的域名的父域名, 则往host写, 如果为空则往页面的域名写, 其他为错误
 * @param {String} param.path 区分业务
 * @param {String} param.key 数据对应的key
 * @param {Function} callback
 * @param {Object} callback.param
 * @param {Number} callback.param.ret 状态返回码
 * @options for callback.param.ret 0: 操作成功
 * @options for callback.param.ret -2: JSON数据格式有误
 * @options for callback.param.ret -3: 参数不能为空
 * @options for callback.param.ret -5: 没有权限操作该域的数据
 * @options for callback.param.ret -6: path不能为空
 * @options for callback.param.ret -7: key不能为空
 * @options for callback.param.ret -8: data不能为空
 * @options for callback.param.ret -9: 空间不足或不存在SD卡
 * @options for callback.param.ret -11: 读取不到任何数据
 * @options for callback.param.ret -12: 写入数据量过大
 * @param {Object} callback.param.response 返回值，例如{"data":"", callid:"2"}
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.readH5Data', {
    iOS: function(params, callback) {

        var callbackName = callback ? mqq.callback(callback) : null;
        mqq.invokeClient('data', 'readWebviewBizData', {
            'callback': callbackName,
            'params': params
        });
    },
    android: function(params, callback) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('publicAccount', 'readH5Data', params,
            mqq.callback(function(result) {

                if (result && result.response && result.response.data) {
                    var data = result.response.data;
                    data = data.replace(/\\/g, ""); //android读出来的数据有些时候会莫名多一些"/"，真是醉了。。。
                    data = decodeURIComponent(data); // android 存入的数据会 encode 一次, 这里要 decode
                    result.response.data = data;
                }
                callback(result);
            }, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.sendRequest
 * @desc 发送请求到指定url拉取数据，若url是qq域的，客户端会自动种上uin和vkey到cookie里
 *
 * @param {String} url
 * @param {Object} params 请求参数
 * @param {Object} options 请求配置
 * @param {String} options.method 'GET'/'POST', 默认为GET
 * @param {Number} options.timeout 超时时间，默认无超时时间
 * @param {Function} callback 回调函数
 * @param {Object} callback.responseText 会原样传入到callback内
 *
 * @example
 * mqq.data.sendRequest({
 *     url: "http://s.web2.qq.com/api/getvfwebqq",
 *     params: {test: 123},
 *     options: {
 *         method: "POST"
 *     }
 * }, function(responseText){
 *     alert(responseText);
 * });
 * @care 带cookie去请求qq.com域URL，可用于构造CSRF漏洞
 * @support iOS 4.5
 * @support android 4.7
 */

mqq.build('mqq.data.sendRequest', {
    iOS: function(opt, callback) {
        var url = opt.url,
            params = opt.params,
            options = opt.options || {},
            context = opt.context;
        //query parameters
        params['_t'] = +new Date();

        //send request to url via client
        mqq.invokeClient('data', 'fetchJson', {
            'method': options.method || 'GET',
            // 'timeout': options.timeout || -1,
            'options': options,
            'url': url,
            'params': mqq.toQuery(params),
            'callback': mqq.callback(callback),
            'context': JSON.stringify(context)
        });
    },
    android: function(opt, callback) {

        // var options = opt.options || {};
        // var method = options.method || 'GET';
        opt.callback = mqq.callback(callback);

        mqq.invokeClient('data', 'sendRequest', opt);
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.7'
    }
});
;/**
 * @function data.setClipboard
 * @desc 复制内容到剪贴板，目前支持纯文本
 *
 * @param {Object} params
 * @param {String} params.text 被复制的内容
 * @param {Function} callback
 * @param {Boolean} callback.result true：复制成功；false：复制失败
 *
 * @support iOS 4.7.2
 * @support android 4.7.2
 */

mqq.build('mqq.data.setClipboard', {
    iOS: function(params, callback) {


        mqq.invokeClient('data', 'setClipboard', params);
        callback && callback(true);

    },
    android: function(params, callback) {

        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('data', 'setClipboard', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '4.7.2'
    }
});
;/**
 * @function data.setReturnBackResult
 * @desc 用于web业务与native view之间的数据回传
 *
 * @param {Object} params 具体内部参数格式可与native端约定
 *
 * @support iOS 5.8
 * @support android 5.8
 * @discard 1
 */
mqq.build('mqq.data.setReturnBackResult', {
    iOS: function(params) {
        mqq.invokeClient('data', 'setReturnBackResult', params);
    },
    android: function(params) {
        mqq.invokeClient('data', 'setReturnBackResult', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.8',
        android: '5.8'
    }
});
;/**
 * @function data.setShareInfo
 * @desc 定制分享出去的url，图片，和文字等
 *
 * @param {Object} params
 * @param {String} [params.share_url] 页面可以定制分享出去的url，可去掉某些敏感参数等，如果不传，则使用页面的url，长度不能超过120字节，超过的请转短链。另外，url必须跟页面url同一个域名，否则设置不生效。
 * @param {String} params.title 分享的标题，最大45字节
 * @param {String} params.desc 分享的摘要，最大60字节
 * @param {String} [params.image_url] 图片URL，原 imageUrl 参数，可以继续使用 imageUrl。注意：图片最小需要200 * 200，否则分享到Qzone时会被Qzone过滤掉。
 * @param {String} [params.source_name] 分享的来源，默认是”QQ浏览器“
 * @param {Function} callback
 *
 * @support iOS 4.6
 * @support android 4.6
 *
 * @example
 * // 另外使用meta同样可以达到该接口的作用
 * <meta itemprop="name" content="这是分享的标题"/>
 * <meta itemprop="image" content="http://imgcache.qq.com/qqshow/ac/v4/global/logo.png" />
 * <meta name="description" itemprop="description" content="这是要分享的内容" />
 *
 * @important iOS端不支持callback回调
 */

mqq.build('mqq.data.setShareInfo', {
    iOS: function(params, callback) {
        if (params['share_url']) {
            params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
        }
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        return mqq.invokeClient('data', 'setShareInfo', {
            'params': params
        }, callback);
    },
    android: function(params, callback) {
        if (params['share_url']) {
            params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
        }
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        mqq.invokeClient('QQApi', 'setShareInfo', params, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.setShareURL
 * @desc 设置分享URL
 *
 * @param {Object} param
 * @param {String} param.url 分享连接
 * @param {Function} callback 回调
 *
 * @support iOS 4.6
 * @support android 4.6
 */


mqq.build('mqq.data.setShareURL', {
    iOS: function(params, callback) {
        if (params.url) {
            params['url'] = mqq.removeQuery(params['url'], ['sid', '3g_sid']);
        }
        mqq.invokeClient('data', 'setShareURL', params, callback);
    },
    android: function(params, callback) {

        if (params.url) {
            params['url'] = mqq.removeQuery(params['url'], ['sid', '3g_sid']);
        }

        if (mqq.compare('4.6') < 0) {
            callback(false);
        } else {
            mqq.invokeClient('QQApi', 'setShareURL', params.url, callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.ssoRequest
 * @desc 手Q客户端SSO通道接口，用于防止恶意HTTP协议请求,注意:默认情况1秒内最多发送5次命令，单次数据包大小限制最大200K
 *
 * @param {Object} params
 * @param {String} params.cmd 请求命令字，与后端协商确定。
 * @param {Object} [params.data] 请求参数，使用JSON格式。
 * @param {Function} callback
 *
 * @support iOS 5.3.2
 * @support android 5.3.2
 *
 * @example
 * mqq.data.ssoRequest({
 *     cmd: 'video_token',
 *     data: {
 *         vid: vid,
 *         guid: guid
 *     }
 * }, function(responseText){
 *     alert(responseText);
 * });
 *
 * @important sso接口与页面域名有关，接入前请阅读<a href="../sso_guide.html" target="_blank">接入指南</a>
 */

mqq.build('mqq.data.ssoRequest', {
    iOS: function(params, callback) {
        params.data = JSON.stringify(params.data || {});
        params.callback = mqq.callback(callback);
        mqq.invokeClient('sso', 'sendRequest', params);
    },
    android: function(params, callback) {
        params.data = JSON.stringify(params.data || {});
        params.callback = mqq.callback(callback);
        mqq.invokeClient('sso', 'sendRequest', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.3.2',
        android: '5.3.2'
    }
});
;/**
 * @function data.startSyncData
 * @desc 开始接收游戏状态变更的PUSH消息
 *
 * @param {Object} param
 * @param {Number} param.appID 游戏的appid
 * @param {Function} callback 收到push消息后调用callback传数据给js的回调
 *
 * @support iOS 4.6
 * @support android 4.6
 * @discard 1
 */

mqq.build('mqq.data.startSyncData', {
    iOS: function(params, callback) {

        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
            mqq.invokeClient('data', 'startSyncData', params);
        }

    },
    android: function(params, callback) {
        var name = mqq.callback(callback);
        mqq.invokeClient('qbizApi', 'startSyncData', params.appID, name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.stopSyncData
 * @desc 停止接收游戏状态变更的PUSH消息
 *
 * @param {Object} param
 * @param {Number} param.appID 游戏的appid
 *
 * @support iOS 4.6
 * @support android 4.6
 * @discard 1
 */

mqq.build('mqq.data.stopSyncData', {
    iOS: function(params) {
        mqq.invokeClient('data', 'stopSyncData', params);
    },
    android: function(params) {

        mqq.invokeClient('qbizApi', 'stopSyncData', params.appID, name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function data.updateLoginInfo
 * @desc 刷新票据，包括：skey，pskey，pt4_token
 *
 * @param {Object} param 参数不能不传，否则会报js错误
 *
 * @param {String} param.key 刷新哪种票据
 * @options for param.key skey
 * @options for param.key pskey
 * @options for param.key pt4_token
 *
 * @param {String} param.callback 回调
 */
;/**
 * @function data.writeH5Data
 * @desc 写数据到本地
 *
 * @param {Object} param
 * @param {String} param.callid 用来标示请求id, 返回时把该值传回
 * @param {String} param.host 如果host不为空, 且是该页面的域名的父域名, 则往host写, 如果为空则往页面的域名写, 其他为错误
 * @param {String} param.path 区分业务
 * @param {String} param.key 数据对应的key
 * @param {String} param.data 数据
 * @param {Function} callback
 * @param {Object} callback.param
 * @param {Number} callback.param.ret 状态返回码
 * @options for callback.param.ret 0: 操作成功
 * @options for callback.param.ret -2: JSON数据格式有误
 * @options for callback.param.ret -3: 参数不能为空
 * @options for callback.param.ret -5: 没有权限操作该域的数据
 * @options for callback.param.ret -6: path不能为空
 * @options for callback.param.ret -7: key不能为空
 * @options for callback.param.ret -8: data不能为空
 * @options for callback.param.ret -9: 空间不足或不存在SD卡
 * @options for callback.param.ret -11: 读取不到任何数据
 * @options for callback.param.ret -12: 写入数据量过大
 * @param {Object} callback.param.response 返回值，例如{callid:"2"}
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.data.writeH5Data', {
    iOS: function(params, callback) {

        // var callbackName = callback ? mqq.callback(callback) : null;
        // 新增默认callback, 以免IOS下crash 20140928
        var callbackName = mqq.callback( callback || function(){} );
        // 兼容对象格式数据 20140928
        var data = params.data;
        if ( data && typeof data === "object" ) {
            // 兼容对象格式数据 20140928
            params.data = JSON.stringify(data);
        }
        mqq.invokeClient('data', 'writeWebviewBizData', {
            'callback': callbackName,
            'params': params
        });
    },
    android: function(params, callback) {
        var data = params.data;
        if (data) {
            // 兼容对象格式数据 20140928
            if ( typeof data === "object" ) data = JSON.stringify(data);
            params.data = encodeURIComponent(data); // android 会对 \ 进行多次转义, 这里要先 encode
        }
        mqq.invokeClient('publicAccount', 'writeH5Data', params,
            // 新增默认callback, 以免android下写入不成功 20140928
            mqq.callback(callback||function(){}, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function debug.detailLog
 * @desc 写入详细日志到终端中，以便在需要的时候提取出来。日志格式为：webviewDebugLog_业务ID|子业务ID|log内容|客户端平台|手Q版本号|操作系统版本|用户QQ号|机器类型|运营商|网络
 * @param {Object} param 参数对象
 * @param {String} param.id 业务ID
 * @param {String} param.subid 子业务ID
 * @param {String} param.content log内容
 * @param {String} param.isall true:全量打印，false：只染色号码打印
 *
 * @example
 * //如下代码将打印日志：webviewDebugLog_mp|get001|test detail log|ios|5.8.0.0|iPhone OS7.1(11D167)|271353531|iPhone 5|中国联通|WIFI
 * mqq.debug.detailLog({
 * id:"mp",
 * subid:"get001",
 * content:"test detail log",
 * isall:true
 * });
 *
 * @support iOS 5.8.0
 * @support android 5.8.0
 */
;
(function () {

    var _getType = function (obj) {
        return obj === null ? "null" : obj === undefined ? "undefined" : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    };
    var _handler = function (params, callback) {
        var _type = _getType(params), obj, level;
        if (_type === 'object') {
            // 低于 v5.8.0 的不支持
            if (mqq.compare('5.8.0') >= 0) {
                obj = {};
                obj.id = "webviewDebugLog_" + params.id;
                obj.subid = params.subid;
                obj.content = params.content;
                obj.isall = false;
                if (_getType(params.level) === 'string') {
                    level = params.level.toLowerCase();
                    if (level == "debug" || level == "info" || level == "error") {
                        obj.level = level;
                    }
                }
                obj.level = obj.level || "info";
                obj.content = obj.content ? obj.content : "";
                obj.content = obj.level + "|" + obj.content;
                if(obj.level =="error"){
                    obj.isall = true;
                }
                return mqq.invokeClient('qw_debug', 'detailLog', obj);
            }
        }
    };

    mqq.build('mqq.debug.detailLog', {
        iOS: _handler,
        android: _handler,
        supportInvoke: true,
        support: {
            iOS: '5.8.0',
            android: '5.8.0'
        }
    });
})();
;/**
 * @function debug.enableConsoleBlackList
 * @desc 启用consoleMessage，配合console.log使用
 *
 * @example
 * mqq.invoke('qw_debug','enableConsoleBlackList', function(result){

 * });
 *
 * @support iOS 7.3.0
 * @support android 7.3.0
 */
;/**
 * @namespace debug
 * @desc 调试模块，用于前端或终端打印日志，并以弹出层的方式显示日志
 */

/**
 * @function debug.hide
 * @desc 隐藏日志信息
 *
 * @param {Boolean} flag 可选，默认是true，是否继续打印日志，true隐藏并继续打印日志，false隐藏并暂停打印日志。
 *
 * @example
 * mqq.debug.hide();
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */

mqq.build('mqq.debug.hide', {
    iOS: function(flag) {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            flag == null && (flag = true);
            return mqq.invokeClient('qw_debug', 'hide', {flag: flag});
        }
    },
    android: function(flag) {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            flag == null && (flag = true);
            return mqq.invokeClient('qw_debug', 'hide', {flag: flag});
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.1',
        android: '4.7.1'
    }
});
;/**
 * @function debug.log
 * @desc 打印日志。即将日志存入终端的日志池中，但不会自动显示打印的日志信息。可以调用 mqq.debug.show() 进行显示。
 *
 * @param {*} data 要打印的日志，任意类型的数据，该数据会转换成字符串显示出来
 *
 * @example
 * mqq.debug.log(123);
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */

mqq.build('mqq.debug.log', {
    iOS: function(data) {
        var _msg = "",
            _getType = function (obj) {
                return obj === null ? "null" : obj === undefined ? "undefined" : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
            },
            _type = _getType(data);

        if (_type === 'function') {
            _msg = data.toString();
        } else if (_type === 'string') {
            _msg = data;
        } else if (_type === 'array') {
            _msg = "[" + data.join() + "]";
        } else {
            _msg = JSON.stringify(data);
        }

        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            return mqq.invokeClient('qw_debug', 'log', {msg: _msg});
        }
    },
    android: function(data){
        var _msg = "",
            _getType = function (obj) {
                return obj === null ? "null" : obj === undefined ? "undefined" : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
            },
            _type = _getType(data);

        if (_type === 'function') {
            _msg = data.toString();
        } else if (_type === 'string') {
            _msg = data;
        } else if (_type === 'array') {
            _msg = "[" + data.join() + "]";
        } else {
            _msg = JSON.stringify(data);
        }

        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            mqq.invokeClient('qw_debug', 'log', {msg: _msg});
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.1',
        android: '4.7.1'
    }
});
;/**
 * @function debug.show
 * @desc 显示日志信息。显示日志的弹出层是由终端实现的
 *
 * @param {Boolean} flag 可选，默认是true，是否继续打印日志，true隐藏并继续打印日志，false隐藏并暂停打印日志。
 *
 * @example
 * mqq.debug.show();
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */

mqq.build('mqq.debug.show', {
    iOS: function(flag) {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            flag == null && (flag = true);
            return mqq.invokeClient('qw_debug', 'show', {flag: flag});
        }
    },
    android: function(flag) {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            flag == null && (flag = true);
            mqq.invokeClient('qw_debug', 'show', {flag: flag});
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.1',
        android: '4.7.1'
    }
});
;/**
 * @function debug.start
 * @desc 开始打印日志。在单元测试时，为了防止过多的其他日志信息干扰，增加一个开始打印接口，和停止打印接口，Web开发者就可以控制只要打印自己关心的日志信息。
 *
 * @example
 * mqq.debug.start();
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */
mqq.build('mqq.debug.start', {
    iOS: function() {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            return mqq.invokeClient('qw_debug', 'start');
        }
    },
    android: function() {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            mqq.invokeClient('qw_debug', 'start');
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.1',
        android: '4.7.1'
    }
});
;/**
 * @function debug.stop
 * @desc 停止打印日志。在单元测试时，为了防止过多的其他日志信息干扰，增加一个开始打印接口，和停止打印接口，Web开发者就可以控制只要打印自己关心的日志信息。从调用该接口开始，终端会丢掉所有后面打印的日志，直到再次调用 mqq.debug.start() 或者 mqq.debug.show(true) 才会将日志存入日志池。
 *
 * @example
 * mqq.debug.stop();
 *
 * @support iOS 4.7.1
 * @support android 4.7.1
 */
mqq.build('mqq.debug.stop', {
    iOS: function() {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            return mqq.invokeClient('qw_debug', 'stop');
        }
    },
    android: function() {
        // 低于 v4.7.1 的不支持
        if (mqq.compare('4.7.1') >= 0) {
            mqq.invokeClient('qw_debug', 'stop');
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.1',
        android: '4.7.1'
    }
});
;/**
 * @namespace device
 * @desc 系统和硬件相关信息
 */

/**
 * @function device.connectToWiFi
 * @desc 连接wifi
 *
 * @param {Object} param
 * @param {String} param.ssid 热点名称
 * @param {String} param.type 热点加密类型: WPA, WEP, nopass
 * @param {String} param.password 密码
 * @param {Function} callback 回调
 * @param {Number} callback.code 状态
 * @options for callback.code 0 - 表示连接成功
 * @options for callback.code 1 - 表示操作失败
 * @options for callback.code 2 - 表示连接超时
 * @options for callback.code 3 - 参数错误
 *
 * @support android 4.7
 * @support iOS not support
 *
 * @care 可用于连接指定恶意WIFI
 */

mqq.build('mqq.device.connectToWiFi', {
    iOS: function(params, callback) {

        callback && callback(mqq.ERROR_NO_SUCH_METHOD);
    },
    android: function(params, callback) {

        params.callback = mqq.callback(callback);

        /* 5.1 ~ 5.3 有坑爹的巨坑，客户端会直接loadUrl去执行穿过去的callback，
         导致显示了个 __MQQ_CALLBACK_0 类似的页面，这里要进行兼容
         5.4 修复了这个问题
         */
        if(params.callback && mqq.compare('5.1') >= 0 && mqq.compare('5.4') < 0){
            params.callback = 'javascript:' + params.callback;
        }
        mqq.invokeClient('qbizApi', 'connectToWiFi', params);
    },
    supportInvoke: true,
    support: {
        android: '4.7'
    }
});
;/**
 * @function device.getClientInfo
 * @desc 获取客户端信息
 *
 * @param {Function} callback 回调
 * @param {Object} callback.param
 * @param {String} callback.param.qqVersion 获取手机QQ版本号，如"4.5.0"
 * @param {String} callback.param.qqBuild 获取手机QQ构建版本号，如"4.5.0.1"，一般不需要使用到这个东东
 *
 * @support iOS 4.5
 * @support android 4.6
 *
 * @care 存在客户端信息泄露风险
 */

/* iOS 接口兼容 */
mqq.build('mqq.device.qqVersion', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'qqVersion', {callback: mqq.callback(callback)});
        }else{
            return mqq.invokeClient('device', 'qqVersion', callback);
        }        
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

mqq.build('mqq.device.qqBuild', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'qqBuild', {callback: mqq.callback(callback)});
        }else{
            return mqq.invokeClient('device', 'qqBuild', callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});
/*end iOS 接口兼容 */

mqq.build('mqq.device.getClientInfo', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'getClientInfo', {callback: mqq.callback(callback)});
        }else{
            var result = {
                'qqVersion': this.qqVersion(),
                'qqBuild': this.qqBuild()
            };
            var callbackName = mqq.callback(callback);
            mqq.__reportAPI('web', 'device', 'getClientInfo', null, callbackName);
            if (typeof callback === 'function') {
                mqq.__fireCallback(callbackName, [result]);
            } else {
                return result;
            }
        }
    },
    android: function(callback) {
        if (mqq.compare('4.6') >= 0) {
            var oldCallback = callback;
            callback = function(data) {
                try {
                    data = JSON.parse(data);
                } catch (e) {}
                oldCallback && oldCallback(data);
            };
            mqq.invokeClient('qbizApi', 'getClientInfo', callback);
        } else {
            mqq.__reportAPI('web', 'device', 'getClientInfo');
            callback({
                qqVersion: mqq.QQVersion,
                qqBuild: function(m) {
                    m = m && m[1] || 0;
                    return m && m.slice(m.lastIndexOf('.') + 1) || 0;
                }(navigator.userAgent.match(/\bqq\/([\d\.]+)/i))
            });
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});
;/**
 * @function device.getDeviceInfo
 * @desc 获取设备信息
 *
 * @param {Function} callback 回调
 * @param {Object} callback.param
 * @param {String} callback.param.systemName 系统名，如"iPhone OS"
 * @param {String} callback.param.systemVersion 系统版本，如"6.0"
 * @param {String} callback.param.model 机器系列，如"iPhone", "iPod touch"
 * @param {String} callback.param.modelVersion 机型，如"iPhone 6"
 * @note for callback.param.modelVersion 该字段仅IOS设备存在
 * @param {String} callback.param.identifier 设备唯一标识，Android端获取的是IMEI码，iOS端获取到的是根据IMEI码加密之后，并且每个APP获取到的均不同
 *
 * @param {String} callback.param.fingerprint 设备指纹，用于识别同品牌同型号同系统版本
 * @support for callback.param.fingerprint iOS not support
 * @support for callback.param.fingerprint android 5.9
 * @param {String} callback.param.incremental 附加版本号，一般标识定制 ROM 的版本
 * @support for callback.param.incremental iOS not support
 * @support for callback.param.incremental android 5.9
 * @param {String} callback.param.macAddress 手机mac地址
 * @support for callback.param.macAddress iOS not support
 * @support for callback.param.macAddress android 5.9
 * @param {String} callback.param.androidID 首次启动随机生成的64位hash值，恢复出场设置此值会被修改
 * @support for callback.param.androidID iOS not support
 * @support for callback.param.androidID android 5.9
 * @param {String} callback.param.imsi imsi号
 * @support for callback.param.imsi iOS not support
 * @support for callback.param.imsi android 5.9
 * @param {String} callback.param.qimei 手机IMEI号
 * @support for callback.param.qimei iOS not support
 * @support for callback.param.qimei android 5.9
 *
 * @param {String} callback.param.totalMemory  总内存
 * @support for callback.param.totalMemory iOS 5.9
 * @support for callback.param.totalMemory android not support
 *
 * @param {String} callback.param.availableMemory 可用内存
 * @support for callback.param.availableMemory iOS 5.9
 * @support for callback.param.availableMemory android not support
 *
 * @param {String} callback.param.usedMemory 已使用内存
 * @support for callback.param.usedMemory iOS 5.9
 * @support for callback.param.usedMemory android not support
 *
 * @param {String} callback.param.isGrayOrAppstore 是否是正式版本 int  0:test 非0 正式版本
 * @support for callback.param.isGrayOrAppstore iOS 5.9
 * @support for callback.param.isGrayOrAppstore android not support
 *
 * @param {String} callback.param.msf_identifier 手Q MSF模拟计算的imei
 * @support for callback.param.msf_identifier iOS 5.9
 * @support for callback.param.msf_identifier android not support
 *
 * @param {String} callback.param.idfa idfa
 * @support for callback.param.idfa iOS 5.9
 * @support for callback.param.idfa android not support
 *
 * @example
 * mqq.device.getDeviceInfo(function(data){
 *     console.log(data);
 * });
 *
 * @support iOS 4.5
 * @support android 4.5
 *
 * @care 存在设备信息泄露风险
 */

/* iOS 接口兼容 */

mqq.build('mqq.device.systemName', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'systemName', {callback: mqq.callback(callback)});
        }else{
            return mqq.invokeClient('device', 'systemName', callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

mqq.build('mqq.device.systemVersion', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'systemVersion', {callback: mqq.callback(callback)});            
        }else{
            return mqq.invokeClient('device', 'systemVersion', callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

mqq.build('mqq.device.model', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'model', {callback: mqq.callback(callback)});            
        }else{
            return mqq.invokeClient('device', 'model', callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

mqq.build('mqq.device.modelVersion', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'modelVersion', {callback: mqq.callback(callback)});            
        }else{
            return mqq.invokeClient('device', 'modelVersion', callback);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

/* end iOS 接口兼容 */

mqq.build('mqq.device.getDeviceInfo', {

    iOS: function(callback) {
        if (mqq.__isWKWebView){
            mqq.invokeClient('device', 'getDeviceInfo', {callback: mqq.callback(callback)});
        } else if (mqq.compare(4.7) >= 0) {
            //4.7把下面這些調用都整合到一個接口上，並提供了一個新的字段identifier來唯一標識設備
            return mqq.invokeClient('device', 'getDeviceInfo', callback);
        } else {
            var callbackName = mqq.callback(callback);
            mqq.__reportAPI('web', 'device', 'getClientInfo', null, callbackName);

            var result = {
                'isMobileQQ': this.isMobileQQ(),
                'systemName': this.systemName(),
                'systemVersion': this.systemVersion(),
                'model': this.model(),
                'modelVersion': this.modelVersion()
            };

            if (typeof callback === 'function') {
                mqq.__fireCallback(callbackName, [result]);
            } else {
                return result;
            }
        }
    },
    android: function(callback) {
        if (mqq.compare('4.6') >= 0) {
            var oldCallback = callback;
            callback = function(data) {
                try {
                    data = JSON.parse(data);
                } catch (e) {}
                oldCallback && oldCallback(data);
            };
            mqq.invokeClient('qbizApi', 'getDeviceInfo', callback);
        } else {
            var ua = navigator.userAgent;
            mqq.__reportAPI('web', 'device', 'getClientInfo');
            callback({
                isMobileQQ: true,
                systemName: 'android',
                systemVersion: function(m) {
                    return m && m[1] || 0;
                }(ua.match(/\bAndroid ([\d\.]+)/i)),
                model: function(m) {
                    return m && m[1] || null;
                }(ua.match(/;\s([^;]+)\s\bBuild\/\w+/i))
            });
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.5'
    }
});
;/**
 * @function device.getNetworkInfo
 * @desc 获取细化的具体网络类型
 *
 * @param {Function} callback 回调
 * @param {Object} callback.param
 * @param {Number} callback.param.type 网络类型，和原本的getNetworkType接口一样
 * @options for callback.param.type -1: Unknown 未知类型网络
 * @options for callback.param.type 0: NotReachable
 * @options for callback.param.type 1: ReachableViaWiFi
 * @options for callback.param.type 2: ReachableVia2G
 * @options for callback.param.type 3: ReachableVia3G
 * @options for callback.param.type 4. 4G
 *
 * @param {String} callback.param.radio 细化的网络类型
 * @options for callback.param.radio gprs, edge, cdma, 1xrtt, evdo0, evdoa, evdob, iden //2G
 * @options for callback.param.radio wcdma, umts, hsdpa, hsupa, hspa, ehrpd, hspap //3G
 * @options for callback.param.radio lte //4G
 * @options for callback.param.radio wifi
 * @options for callback.param.radio unknown
 *
 * @param {Number} callback.carriertype 运营商 (6.5.0 开始支持)
 * @options for callback.carriertype 0: 未知
 * @options for callback.carriertype 1: 中国移动
 * @options for callback.carriertype 2: 中国联通
 * @options for callback.carriertype 3: 中国电信
 * @options for callback.carriertype 4. 中国铁通
 *
 * @support iOS 5.2
 * @support android 5.2
 *
 * @care 存在网络信息泄露风险
 */

(function() {

    var RADIO_TYPE_MAP = {
        // ios
        // 2G
        'CTRadioAccessTechnologyGPRS': 'gprs',
        'CTRadioAccessTechnologyEdge': 'edge',
        // 3G
        'CTRadioAccessTechnologyWCDMA': 'wcdma',
        'CTRadioAccessTechnologyHSDPA': 'hsdpa',
        'CTRadioAccessTechnologyCDMA1x': 'cdma',

        'CTRadioAccessTechnologyCDMAEVDORev0': 'evdo0',
        'CTRadioAccessTechnologyCDMAEVDORevA': 'evdoa',
        'CTRadioAccessTechnologyCDMAEVDORevB': 'evdob',
        // 4G
        'CTRadioAccessTechnologyeHRPD': 'ehrpd',
        'CTRadioAccessTechnologyLTE': 'lte',
        // Android
        // 2G
        //通用分组无线服务技术（General Packet Radio Service，缩写：GPRS）是GSM移动电话用户可用的一种移动数据业务。 它经常被描述成“2.5G”，也就是说这项技术位于第二代（2G）和第三代（3G）移动通讯技术之间。它通过利用GSM网络中未使用的TDMA信道，提供中速的数据传递。最初有人想通过扩展GPRS来覆盖其他标准，只是这些网络都正在转而使用GSM标准，这样GSM就成了GPRS唯一能够使用的网络。GPRS在Release 97之后被集成进GSM标准,起先它是由ETSI标准化的，但是当前已经移交3GPP负责。
        'NETWORK_TYPE_GPRS': 'gprs',
        //GSM增强数据率演进（Enhanced Data rates for GSM Evolution，缩写：EDGE），是一种数字移动电话技术，作为一个2G和2.5G（GPRS）的延伸，有时被称为2.75G。这项技术工作在TDMA和GSM网络中。EDGE（通常又称为：EGPRS）是GPRS的扩展，可以工作在任何已经部署GPRS的网络上。（只要MS和BTS设备做一些必要的升级）。
        'NETWORK_TYPE_EDGE': 'edge',

        //码分多址（英语：Code Division Multiple Access，即：CDMA）或分码多重进接、码分复存，是一种多址接入的无线通信技术。CDMA最早用于军用通信，但时至今日，已广泛应用到全球不同的民用通信中。在CDMA移动通信中，将话音频号转换为数字信号，给每组数据话音分组增加一个地址，进行扰码处理，并且将它发射到空中。CDMA最大的优点就是相同的带宽下可以容纳更多的呼叫，而且它还可以随话音传送数据信息。
        'NETWORK_TYPE_CDMA': 'cdma',

        'NETWORK_TYPE_1xRTT': '1xrtt',

        // EV-DO是英文Evolution-Data Optimized或者Evolution-Data only的缩写。有时也写做EVDO或者EV。CDMA2000 1xEV-DO是一种可以满足移动高速数据业务的技术。一条EV-DO信道的频宽为1.25 MHz[1]。实际建网时需要使用两个不同的载波支持语音与数据业务，这虽然降低了频率利用率，不过从频谱效率上看，CDMA2000 1X+CDMA2000 1xEV-DO的传输数据能力已经大大超过WCDMA（目前WCDMA能够实现的R4版本空中接口速率为2.4Mbps/5Mhz，而CDMA2000 1xEV-DO Release 0速率为2.4Mbps，CDMA2000 1xEV-DO Revision A速率为3.1Mbps，CDMA2000 1xEV-DO Revision B速率为9.3Mbps）。而且从技术实现上面来看，语音业务和数据业务分开，既保持了高质量的语音，又获得了更高的数据传输速率。网络规划和优化上CDMA2000 1X和CDMA2000 1xEV-DO也相同，各个主要设备制造商的系统都能支持从CDMA2000 1X向CDMA2000 1xEV-DO的平滑升级，这对于电信运营商在技术和投资方面的选择都很理想，有助于CDMA2000 1xEV-DO的推广。
        'NETWORK_TYPE_EVDO_0': 'evdo0',
        'NETWORK_TYPE_EVDO_A': 'evdoa',
        'NETWORK_TYPE_EVDO_B': 'evdob',

        //集成数字增强网络, (Integrated Digital Enhanced Network - iDEN),是一种由摩托罗拉公司开发的数字无线通信技术。它的特点是为用户同时提供集群电话的双向对讲功能和蜂窝电话的功能。iDEN系统在无线接口使用时分多址技术。使用iDEN技术的最大运营商是美国Nextel公司。
        'NETWORK_TYPE_IDEN': 'iden',
        // 3G
        // 通用移动通讯系统（Universal Mobile Telecommunications System，缩写：UMTS）是当前最广泛采用的一种第三代（3G） 移动电话技术。它的无线接口使用WCDMA技术，由 3GPP定型，代表欧洲对ITU IMT-2000 关于3G蜂窝无线系统需求的回应。UMTS有时也叫3GSM，强调结合了3G技术而且是GSM标准的后续标准。UMTS 分组交换系统是由 GPRS 系统所演进而来，故系统的架构颇为相像。
        'NETWORK_TYPE_UMTS': 'umts',

        //高速下行分组接入（High Speed Downlink Packet Access的缩写HSDPA）是一种移动通信协议，亦称为3.5G(3?G)，属于WCDMA技术的延伸。该协议在WCDMA下行链路中提供分组数据业务，在一个5MHz载波上的传输速率可达8-10 Mbit/s（如采用MIMO技术，则可达20 Mbit/s）。在具体实现中，采用了自适应调制和编码（AMC）、多输入多输出（MIMO）、混合自动重传请求（HARQ）、快速调度、快速小区选择等技术。由于开放了新的高速下行链路共享信道（High-Speed Downlink Shared Channel，HS-DSCH），加上强化了本身的传输技术，包括优化数据分组传送调度及出现错误时的传送程序、采用较短帧长（frame length）以加快分组传送调度、加入递增冗余（Incremental Redundancy）减少重新传送对接口的负担等，令HSDPA的数据下载速度最高可达14.4Mbps，理论上可以比3G技术快5倍，比GPRS技术快20倍。
        'NETWORK_TYPE_HSDPA': 'hsdpa',

        //高速上行分组接入（High Speed Uplink Packet Access 的缩写 HSUPA）是一种因 HSDPA 上传速度不足（只有 384Kb/s）不足而开发的，亦称为3.75G，可在一个5MHz载波上的传输速率可达10-15 Mbit/s（如采用 MIMO 技术，则可达28 Mbit/s）、上传速度达 5.76Mb/s（使用3GPP Rel7技术，更达11.5 Mbit/s），令需要大量上传带宽的功能如双向视频直播或 VoIP 得以顺利实现，所以具体上都比3.5G好。 而各电讯业者亦表示在 2007 年尾至 2008 年间会开通该服务。
        'NETWORK_TYPE_HSUPA': 'hsupa',
        //高速封包存取（High Speed Packet Access, HSPA），是WCDMA第一个进化技术，HSPA可增加资料传输速率（1－3Mbps），可减少延迟。继 HSPA之后，还有HSDPA, HSUPA 以及 HSPA+的推出。
        'NETWORK_TYPE_HSPA': 'hspa',

        'NETWORK_TYPE_EHRPD': 'ehrpd',
        'NETWORK_TYPE_HSPAP': 'hspap',
        // 4G
        //3GPP长期演进技术（3GPP Long Term Evolution, LTE）为第三代合作伙伴计划（3GPP）标准，使用“正交频分复用”（OFDM）的射频接收技术，以及2×2和4×4 MIMO的分集天线技术规格。同时支援FDD（频分双工）和TDD（时分双工）。LTE是GSM超越3G与HSDPA阶段迈向4G的进阶版本。LTE也被俗称为3.9G。2010年12月6日国际电信联盟把LTE正式称为4G.
        'NETWORK_TYPE_LTE': 'lte',
        // WiFi
        'NETWORK_TYPE_WIFI': 'wifi',
        // unknown
        'NETWORK_TYPE_UNKNOWN': 'unknown'

    };


    function translate(data, callback) {
        if (typeof data === 'string' && data.indexOf('Permission denied') != -1){
            return callback && callback(data);
        }
        if (typeof data === 'string' && /^{.*?}$/.test(data)) {
            data = JSON.parse(data);
        }
        if (data && ('radio' in data)) {
            if (data.type === 1) {
                data.radio = 'wifi';
            } else if (data.type >= 2) {
                data.radio = RADIO_TYPE_MAP[data.radio] || data.radio;
            } else {
                data.radio = 'unknown';
            }
        }
        callback && callback(data);
    }

    mqq.build('mqq.device.getNetworkInfo', {
        iOS: function(callback) {
            mqq.invokeClient('device', 'getNetworkInfo', {
                callback: mqq.callback(function(data) {
                    translate(data, callback);
                }, false, true)
            });
        },
        android: function(callback) {
            mqq.invokeClient('qbizApi', 'getNetworkInfo', function(data) {
                translate(data, callback);
            });
        },
        supportInvoke: true,
    support: {
            iOS: '5.2',
            android: '5.2'
        }
    });
})();
;/**
 * @function device.getNetworkType
 * @desc 获取网络类型
 *
 * @param {Function} callback 回调
 * @param {Number} callback.result 结果
 * @options for callback.result -1: Unknown 未知类型网络
 * @options for callback.result 0: NotReachable
 * @options for callback.result 1: ReachableViaWiFi
 * @options for callback.result 2: ReachableVia2G
 * @options for callback.result 3: ReachableVia3G
 * @options for callback.result 4. 4G
 *
 * @example
 * mqq.device.getNetworkType(function(result){
 *     alert(result);
 * });
 *
 * @support iOS 4.5
 * @support android 4.6
 */

mqq.build('mqq.device.getNetworkType', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'networkStatus', {callback: mqq.callback(callback)});
        }else{
            var result = mqq.invokeClient('device', 'networkStatus');
            result = Number(result); // 4.7.1 返回的是字符串数字...
            if (typeof callback === 'function') {
                mqq.__fireCallback(callback, [result]);
            } else {
                return result;
            }
        }
    },
    android: function(callback) {
        if (mqq.compare('4.6') >= 0) {
            mqq.invokeClient('qbizApi', 'getNetworkType', callback);
        } else {
            mqq.invokeClient('publicAccount', 'getNetworkState', function(state) {
                // 0: mobile, 1: wifi, 2...: other
                var map = {
                    '-1': 0,
                    '0': 3,
                    '1': 1
                };
                var newState = (state in map) ? map[state] : 4;
                callback(newState);
            });
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});

/* iOS 的接口兼容 */
mqq.build('mqq.device.networkStatus', {
    iOS: mqq.device.getNetworkType,
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});

mqq.build('mqq.device.networkType', {
    iOS: mqq.device.getNetworkType,
    supportInvoke: true,
    support: {
        iOS: '4.5'
    }
});
/* end iOS 的接口兼容 */
;/**
 * @function device.getWebViewType
 * @desc 获取当前页面WebView的类型
 *
 * @param {Function} callback 回调
 * @param {Number} callback.result 结果
 * @options for callback.result 1 - 通用
 * @options for callback.result 2 - 优惠券
 * @options for callback.result 3 - 我的优惠
 * @options for callback.result 4 - 二维码
 * @options for callback.result 5 - 公众帐号(android)
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.device.getWebViewType', {
    iOS: function(callback) {
        if(mqq.__isWKWebView){
            mqq.invokeClient('device', 'webviewType', {callback: mqq.callback(callback)});            
        }else{
            return mqq.invokeClient('device', 'webviewType', callback);
        }
    },
    android: function(callback) {
        // 1 通用
        // 2 优惠券 PA Coupon
        // 3 我的优惠 PA MyCoupon
        // 4 二维码 QR
        // 5 公众帐号 PA
        var type = 1,
            ua = navigator.userAgent;
        if (/\bPA\b/.test(ua)) {
            type = 5;
            if (/\bCoupon\b/.test(ua)) {
                type = 2;
            } else if (/\bMyCoupon\b/.test(ua)) {
                type = 3;
            }
        } else if (/\bQR\b/.test(ua)) {
            type = 4;
        }
        mqq.__reportAPI('web', 'device', 'getWebViewType');
        return callback ? callback(type) : type;
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});

/* iOS 接口兼容 */
mqq.build('mqq.device.webviewType', {
    iOS: mqq.device.getWebViewType,
    supportInvoke: true,
    support: {
        iOS: '4.6'
    }
});
/* end iOS 接口兼容 */
;/**
 * @function device.isMobileQQ
 * @desc 检测页面是否在手机QQ内
 *
 * @param {Function} callback 回调
 * @param {Boolean} callback.result
 *
 * @support iOS 4.2
 * @support android 4.2
 */

mqq.build('mqq.device.isMobileQQ', {
    iOS: function(callback) {
        var result = ['iPhoneQQ', 'iPadQQ'].indexOf(mqq.platform) > -1;
        return callback ? callback(result) : result;
    },
    android: function(callback) {
        var result = mqq.platform === 'AndroidQQ';
        return callback ? callback(result) : result;
    },
    browser: function(callback) {
        var result = ['iPhoneQQ', 'iPadQQ', 'AndroidQQ'].indexOf(mqq.platform) > -1;
        return callback ? callback(result) : result;
    },
    supportSync: true,
    supportInvoke: true,
    support: {
        iOS: '4.2',
        android: '4.2'
    }
});
;/**
 * @function device.setScreenStatus
 * @desc 设置屏幕是否常亮
 *
 * @param {Object} param
 * @param {Number} param.status 状态标识
 * @options for param.status 0 - 屏幕不长亮
 * @options for param.status 1 - 屏幕长亮
 *
 * @param {Function} callback
 * @param {Number} callback.result 返回当前状态
 * @options for callback.result 0 - 屏幕不长亮
 * @options for callback.result 1 - 屏幕长亮
 * @param {String} callback.message 当前状态的文字描述
 *
 * @support iOS not support
 * @support android 5.0
 */

mqq.build('mqq.device.setScreenStatus', {
    iOS: function(params, callback) {

        params = params || {};
        params.callback = mqq.callback(callback);
        mqq.invokeClient('device', 'setScreenStatus', params);

    },
    android: function(params, callback) {

        params = params || {};
        params.callback = mqq.callback(callback);
        mqq.invokeClient('device', 'setScreenStatus', params);
    },
    supportInvoke: true,
    support: {
        android: '5.0'
    }
});
;mqq.build('mqq.event.dispatchEvent', {
    iOS: function() {
        mqq.invokeClient('event', 'dispatchEvent');
    },
    android: function() {
        mqq.invokeClient('event', 'dispatchEvent');
    },
    supportInvoke: true,
    support: {
        iOS: '5.0',
        android: '5.0'
    }
});
;/**
 * @namespace media
 * @desc 媒体相关接口
 */

/**
 * @function media.getLocalImage
 * @desc 读取给定路径的本地图片，本接口是配合 getPicture 使用的。主要应用于使用 getPicture 时用户选择多张图片的场景，此时如果全部图片内容一起返回给页面，会导致页面卡死。因此可以指定 getPicture 的 urlOnly 参数，同时使用本接口单独加载图片
 *
 * @param {Object} param
 * @param {String} param.imageID getPicture 接口返回的 imageID
 * @param {Number} param.outMaxWidth 限制输出的图片的最大宽度，超过将会压缩到指定值
 * @default for param.outMaxWidth 1280
 * @param {Number} param.outMaxHeight 限制输出的图片的最大高度，超过将会压缩到指定值
 * @default for param.outMaxHeight 1280
 * @param {Number} param.inMinWidth 限制输入的图片(展示给用户选择的)的最小宽度
 * @param {Number} param.inMinHeight 限制输入的图片(展示给用户选择的)的最小高度
 *
 * @param {Function} callback
 * @param {Number} callback.ret 0：成功；3：内存不足
 * @param {Object} callback.images
 * @param {String} callback.images.data 所选图片的base64数据
 * @param {String} callback.images.imageID 所选图片的在手机QQ本地对应的路径
 * @param {Number} callback.images.match 所选图片是否符合最大最小尺寸要求等。0：符合要求；1：图片尺寸太小；2：读取、解码失败
 *
 * @support iOS 4.7.2
 * @support android 4.7.2
 */


mqq.build('mqq.media.getLocalImage', {
    iOS: function(params, callback) {

        params.callback = mqq.callback(callback);
        mqq.invokeClient('media', 'getLocalImage', params);

    },
    android: function(params, callback) {

        params.callback = mqq.callback(callback);
        mqq.invokeClient('media', 'getLocalImage', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '4.7.2'
    }
});
;/**
 * @function media.getPicture
 * @desc 从相册选择图片或者调用摄像头拍照，以base64返回数据
 *
 * @param {Object} param
 * @param {Number} param.source 控制来源的，0：相册；1：拍照
 * @param {Boolean} [param.front] 是否使用前置摄像头
 * @note for param.front 安卓该参数不一定生效,系统相机可能不支持该参数; 已知oppo系列指定前置时无法在系统相机内切换到后置
 * @param {Number} param.max 最大张数限制
 * @param {Number} param.outMaxWidth 限制输出的图片的最大宽度，超过将会压缩到指定值
 * @default for param.outMaxWidth 1280
 * @param {Number} param.outMaxHeight 限制输出的图片的最大高度，超过将会压缩到指定值
 * @default for param.outMaxHeight 1280
 * @param {Number} param.inMinWidth 限制输入的图片(展示给用户选择的)的最小宽度
 * @param {Number} param.inMinHeight 限制输入的图片(展示给用户选择的)的最小高度
 * @param {Boolean} param.urlOnly 为 true 则只返回 imageID，不返回 data 和 match，此时 outMaxHeight/outMaxWidth/inMinHeight/inMinWidth 无效。之后可以使用 getLocalImage 接口自行加载对应的图片内容
 * @support for param.urlOnly iOS 4.7
 * @support for param.urlOnly android 4.7
 *
 * @param {Function} callback
 * @param {Number} callback.ret 0：成功；3：内存不足
 * @param {Array|Object} callback.images
 * @param {String} callback.images.data 所选图片的base64数据
 * @param {String} callback.images.imageID 所选图片的在手机QQ本地对应的路径
 * @param {Number} callback.images.match 所选图片是否符合最大最小尺寸要求等。0：符合要求；1：图片尺寸太小；2：读取、解码失败
 *
 * @support iOS 4.7
 * @support android 4.7
 * @note iOS 4.7.2 以前的接口裁压缩现有Bug，如果图片宽高超过 outMaxWidth / outMaxHeight，将会被裁剪，4.7.2已修复为压缩
 * @change v4.7: 修改参数名，增加图片最小宽高的限制
 * @change v4.7.2: 增加 urlOnly 参数
 */

mqq.build('mqq.media.getPicture', {
    iOS: function(params, callback) {
        // 对 4.6的参数名进行兼容
        if (!params.outMaxWidth && params.maxWidth) {
            params.outMaxWidth = params.maxWidth;
            delete params.maxWidth;
        }
        if (!params.outMaxHeight && params.maxHeight) {
            params.outMaxHeight = params.maxHeight;
            delete params.maxHeight;
        }

        params.callback = mqq.callback(function(code, data){
            // 修复 ios 的选取拍照图片时, 返回的数组元素是个base64字符串的问题
            if(data && data.forEach){
                data.forEach(function(item, i){
                    if(typeof item === 'string'){
                        data[i] = {
                            data: item,
                            imageID: '',
                            match: 0
                    }
                    }
                });
            }
            callback && callback(code, data);
        }, true /*deleteOnExec*/);
        mqq.invokeClient('media', 'getPicture', params);
    },
    android: function(params, callback) {
        params.callback = mqq.callback(callback);
        mqq.invokeClient('media', 'getPicture', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function media.playLocalSound
 * @desc 播放离线包里的音频
 *
 * @param {Object} param
 * @param {Number} param.bid 离线业务的id
 * @param {String} param.url 音频文件的路径，相对离线包根目录
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.media.playLocalSound', {
    iOS: function(params) {
        mqq.invokeClient('sensor', 'playLocalSound', params);
    },
    android: function(params) {
        mqq.invokeClient('qbizApi', 'playVoice', params.bid, params.url);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function media.preloadSound
 * @desc 预加载离线包内的音频资源
 *
 * @param {Object} param
 * @param {Number} param.bid 离线业务的id
 * @param {String} param.url 音频文件的路径，相对离线包根目录
 *
 * @param {Function} callback
 * @param {Number} callback.ret 1加载成功，0加载失败
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.media.preloadSound', {
    iOS: function(params, callback) {
        params.callback = mqq.callback(callback, true);
        mqq.invokeClient('sensor', 'preloadSound', params);
    },
    android: function(params, callback) {
        mqq.invokeClient('qbizApi', 'preloadVoice', params.bid, params.url,
            mqq.callback(callback, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function media.saveImage
 * @desc 保存指定图片到手机相册（Android是保存到 QQImage 目录，相机程序会识别出来）
 *
 * @param {Object} param
 * @param {String} param.content 图片的base64数据或者图片url
 * @param {Function} callback
 * @param {Object} callback.data
 * @param {String} callback.data.retCode
 * @options for callback.data.retCode 0: 保存成功
 * @options for callback.data.retCode 1: 没有写入相册的权限
 * @options for callback.data.retCode 2: 无效数据（针对base64）
 * @options for callback.data.retCode 3: 下载失败（针对url）
 * @options for callback.data.retCode -1: 其他错误
 * @param {String} callback.data.statusCode http状态码（针对url）
 * @param {String} callback.data.msg 错误详情
 * @param {String} callback.data.imageID 图片本地路径，可通过 getLocalImage 接口取图片
 *
 * @support iOS 5.1
 * @support android 5.2
 *
 * @care 往用户设备本地写图片，存在广告推广风险
 */

mqq.build('mqq.media.saveImage', {
    iOS: function(params, callback) {

        params.callback = mqq.callback(callback, false);
        mqq.invokeClient('media', 'saveImage', params);
    },
    android: function(params, callback) {

        params.callback = mqq.callback(callback, false);
        mqq.invokeClient('media', 'saveImage', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.1',
        android: '5.2'
    }
});
;/**
 * @function media.showPicture
 * @desc 调起手Q端的图片查看器
 *
 * @param {Object} param
 * @param {Array} param.imageIDs 图片url或本地路径
 * @param {Number} param.index 初始显示图片id, 默认为0
 * @param {Number} param.srcID 上报来源参数，默认空，对应值：群公告-0, 群动态-1, 群部落-2, 吃喝玩乐-3
 * @param {Boolean} param.isNotShowIndex 是否不显示图片状态UI，默认false
 *
 * @example
 * mqq.media.showPicture({
 *     imageIDs : [
 *         "http://pub.idqqimg.com/qqmobile/pic/b1.jpg",
 *         "http://pub.idqqimg.com/qqmobile/pic/b2.jpg",
 *         "http://pub.idqqimg.com/qqmobile/pic/b3.jpg",
 *         "http://pub.idqqimg.com/qqmobile/pic/b4.jpg"
 *     ],
 *     index : 2,
 *     srcID : 0,
 *     isNotShowIndex : false
 * })
 *
 * @support iOS 5.0
 * @support android 5.0
 * @note android 5.1.1以下不支持`index`与`isNotShowIndex`参数，且默认不显示图片状态的UI
 */

mqq.build('mqq.media.showPicture', {
    iOS: function(params, callback) {

        // params.callback = mqq.callback(callback, true /*deleteOnExec*/);
        mqq.invokeClient('troopNotice', 'showPicture', params, callback);
    },
    android: function(params, callback) {

        // params.callback = mqq.callback(callback, true);
        mqq.invokeClient('troopNotice', 'showPicture', params, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '5.0',
        android: '5.0'
    }
});
;/**
 * @namespace nfc
 * @desc  
 */

/**
 * @function nfc.addTagDiscoveredListener
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc 用于注册一个嘀卡事件通知，调用后，用户嘀卡，h5会在callback回调中接收到这个嘀卡通知
 *
 *
 * @param {Object} param
 * @param {String} param.tagDiscovered tagDiscovered 事件名称，不能变

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode -1: 请求参数错误
 * @options for callback.data.retcode -2: cgi鉴权失败
 * @options for callback.data.retcode -3：没有嘀卡，tag为空
 * @options for callback.data.retcode -4：卡片连接失败
 * @options for callback.data.retcode -5：capdu执行失败
 * @options for callback.data.retcode -6：内部程序异常
 * @options for callback.data.retcode -7:service连接失败
 * @options for callback.data.retcode -8:插件安装失败
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
  
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于注册一个嘀卡事件通知，调用后，用户嘀卡，h5会在callback回调中接收到这个嘀卡通知。
 * @change  
 */
mqq.build('mqq.nfc.addTagDiscoveredListener', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
		mqq.addEventListener("tagDiscovered", callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.addEventListener("tagDiscovered", callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @namespace nfc
 * @desc  
 */

/**
 * @function nfc.addTagDiscoveredListener
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc 用于注册一个嘀卡事件通知，调用后，用户嘀卡，h5会在callback回调中接收到这个嘀卡通知
 *
 *
 * @param {Object} param
 * @param {String} param.tagDiscovered tagDiscovered 事件名称，不能变

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode -1: 请求参数错误
 * @options for callback.data.retcode -2: cgi鉴权失败
 * @options for callback.data.retcode -3：没有嘀卡，tag为空
 * @options for callback.data.retcode -4：卡片连接失败
 * @options for callback.data.retcode -5：capdu执行失败
 * @options for callback.data.retcode -6：内部程序异常
 * @options for callback.data.retcode -7:service连接失败
 * @options for callback.data.retcode -8:插件安装失败
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
  
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于注册一个嘀卡事件通知，调用后，用户嘀卡，h5会在callback回调中接收到这个嘀卡通知。
 * @change  
 */
mqq.build('mqq.nfc.addTagDiscoveredListener', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
		mqq.addEventListener("tagDiscovered", callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.addEventListener("tagDiscovered", callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @namespace nfc
 * @desc  
 */

/**
 * @function nfc.getNfcStatus
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc 用于获取手机是否支持nfc，是否打开nfc
 *
 * @param {Object} param
 * @param {String} param.sessiontoken 初始化返回的sessiontoken用作鉴权
 

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode 0:手机支持nfc，且nfc开关打开且没有禁用nfc权限
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
 
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于获取手机是否支持nfc，是否打开nfc。
 * @change  
 */
mqq.build('mqq.nfc.getNfcStatus', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'getNfcStatus', JSON.stringify(params), callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'getNfcStatus', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @namespace nfc
 * @desc nfc初始化接口
 */

/**
 * @function nfc.nfcInit
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc nfc功能初始化接口
 *
 * @param {Object} param
 * @param {String} param.card_union 必须设置。通卡名称
 * @param {String} param.verifytoken 鉴权token，根据事先给通卡商户分配的鉴权key和timestamp、random一起由通卡服务器生成，用户初始化鉴权。（必选字段）
 * @param {String} param.timestamp 通卡商户传递的当前时间戳
 * @param {String} param.random 通卡商户传递的随机数
 * @param {String} param.needwritecard 是否使用读写卡api 如果为false表示当前h5页面不需要读写卡能力，如：通卡的帮助页等； 如果为true表示当前h5页面需要读写卡，这个时候会做鉴权处理；
 

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode -1: 请求参数错误
 * @options for callback.data.retcode -2: cgi鉴权失败
 * @options for callback.data.retcode -3：没有嘀卡，tag为空
 * @options for callback.data.retcode -4：卡片连接失败
 * @options for callback.data.retcode -5：capdu执行失败
 * @options for callback.data.retcode -6：内部程序异常
 * @options for callback.data.retcode -7:service连接失败
 * @options for callback.data.retcode -8:插件安装失败
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
 
 * @param {Function} callback.data.data  
 * @param {String} callback.data.data.sessiontoken 返回的鉴权sessiontoken，其他api用到
 
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于NFC jsapi接口调用的初始化，如果需要使用NFC jsapi就必须要初始化，包含了接口鉴权逻辑。每个H5页面必须调用，否则可能贴卡后拉起手Q公交卡插件页面。
 * @change  
 */
mqq.build('mqq.nfc.nfcInit', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcInit', JSON.stringify(params), callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcInit', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @namespace nfc
 * @desc nfc执行指令接口
 */

/**
 * @function nfc.nfcTranceive
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc nfc执行指令接口
 *
 * @param {Object} param
 * @param {String} param.sessiontoken 初始化返回的sessiontoken用作鉴权
 * @param {String} param.capdu 要执行的apdu指令，支持|分割（必选字段）

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode -1: 请求参数错误
 * @options for callback.data.retcode -2: cgi鉴权失败
 * @options for callback.data.retcode -3：没有嘀卡，tag为空
 * @options for callback.data.retcode -4：卡片连接失败
 * @options for callback.data.retcode -5：capdu执行失败
 * @options for callback.data.retcode -6：内部程序异常
 * @options for callback.data.retcode -7:service连接失败
 * @options for callback.data.retcode -8:插件安装失败
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
 
 * @param {Function} callback.data.data  
 * @param {String} callback.data.data.rapdu 返回的rapdu
 
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于NFC 执行某些apdu，使用前必须要调用初始化api。
 * @change  
 */
mqq.build('mqq.nfc.nfcTranceive', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcTranceive', JSON.stringify(params), callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcTranceive', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @namespace nfc
 * @desc nfc反注册接口
 */

/**
 * @function nfc.nfcUnInit
 * @developer CDG企业发展事业群\支付基础平台与金融应用线\301支付平台部\行业应用与国际支付中心\产品开发组\NFC应用开发组 [ios]jesonma [android]jesonma
 * @desc nfc反注册接口
 *
 *
 * @param {Object} param
 * @param {String} param.sessiontoken 初始化返回的sessiontoken用作鉴权

 * @param {Function} callback
 * @param {Function} callback.data

 * @param {String} callback.data.interface 调用的jsapi名称
 * @options for callback.data.interface nfcInit: 初始化jsapi
 * @options for callback.data.interface nfcTranceive: 执行指令
 * @options for callback.data.interface nfcUnInit: 反注册指令接口
 * @options for callback.data.interface addTickcardListener: 嘀卡事件通知接口
 * @options for callback.data.interface getNfcStatus: 获取nfc状态接口

 * @param {Number} callback.data.retcode 返回码
 * @options for callback.data.retcode -1: 请求参数错误
 * @options for callback.data.retcode -2: cgi鉴权失败
 * @options for callback.data.retcode -3：没有嘀卡，tag为空
 * @options for callback.data.retcode -4：卡片连接失败
 * @options for callback.data.retcode -5：capdu执行失败
 * @options for callback.data.retcode -6：内部程序异常
 * @options for callback.data.retcode -7:service连接失败
 * @options for callback.data.retcode -8:插件安装失败
 * @options for callback.data.retcode -9:手机不支持nfc功能
 * @options for callback.data.retcode -10: 手机nfc开关没有打开
 * @options for callback.data.retcode -11: nfc权限被禁用
 
 * @param {String} callback.data.retmsg 返回信息
  
 * @support iOS 6.5.5
 * @support android 6.5.5
 * @note 用于NFC jsapi反注册接口，用于做清理的操作，页面退出时调用。
 * @change  
 */
mqq.build('mqq.nfc.nfcUnInit', {
    android: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcUnInit', JSON.stringify(params), callback);
    },
    iOS: function(params, callback) {
		params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('nfc', 'nfcUnInit', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '6.5.5',
        iOS: '6.5.5'
    }
});
;/**
 * @function offline.batchCheckUpdate
 * @desc 批量检查离线包更新的接口
 *
 * @param {Object} param
 * @param {Array} param.bids 离线包ID
 * @param {Function} callback
 * @param {Obejct} callback.result 查询结果
 *
 * @example
 * mqq.offline.batchCheckUpdate({ bids: [108, 128] }, function(result){
 *     // { retcode: 0, data: { 108: {updateInfo }, 128: {updateInfo }}}
 * });
 *
 * @important iOS端回调报错，但接口调用能够生效，该问题会在5.8版本修复
 * @support iOS 5.4
 * @support android 5.4
 */

mqq.build('mqq.offline.batchCheckUpdate', {
    iOS: function(params, callback) {
        if (callback) params.callback = mqq.callback(callback);
        // try{
        mqq.invokeClient('offline', 'batchCheckUpdate', params);
        // }catch(e) {}
    },
    android: function(params, callback) {
        // var oldCallback = callback;
        params.callback = mqq.callback(function(data) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                try {
                    data = new Function('return ' + data)();
                } catch (e) {}
            }
            callback && callback(data || {});
        });

        mqq.invokeClient('offline', 'batchCheckUpdate', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @namespace offline
 * @desc 离线相关接口
 */

/**
 * @function offline.checkUpdate
 * @desc 查询后台是否有更新
 *
 * @param {Object} param
 * @param {Number} param.bid 离线包ID
 * @param {Function} callback
 * @param {Object} callback.response 查询结果
 *
 * @example
 * //后台JSON示例：
 * //无更新：
 * {
 *     "r":0,
 *     "type":0
 * }
 * //有更新：
 * {
 *     "r":0,
 *     "type":1,
 *     "uptype":0,
 *     "url":"http://pub.idqqimg.com/pc/misc/qmobile/native/package/20080.zip",
 *     "version":20080
 * }
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.offline.checkUpdate', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(function (ret) {
            callback && callback(ret.data)
        });
        if (callbackName) {
            params.callback = callbackName;
            mqq.invokeClient('offline', 'checkUpdate', params);
        }
    },
    android: function(params, callback) {

        mqq.invokeClient('qbizApi', 'checkUpdate', params.bid, mqq.callback(function (ret) {
            callback && callback(Array.isArray(ret.data) ? ret.data[0] : ret)
        }));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function offline.clearCache
 * @desc 清理离线包缓存
 *
 * @param {Object} param
 * @param {Number} param.bid 离线包ID
 * @param {Function} callback
 * @param {Obejct} callback.result 操作结果
 *
 * @example
 * mqq.offline.clearCache({ bid: 128 }, function(result){
 *     // { retcode: 0, msg: 'ok' }
 * });
 *
 * @important iOS端回调报错，但接口调用能够生效，该问题会在5.8版本修复
 *
 * @support iOS 5.4
 * @support android 5.4
 */

mqq.build('mqq.offline.clearCache', {
    iOS: function(params, callback) {
        if ( callback ) params.callback = mqq.callback(callback);
        // try{
        mqq.invokeClient('offline', 'clearCache', params);
        // } catch(e){}
    },
    android: function(params, callback) {
        var oldCallback = callback;
        callback = function(data) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                try {
                    data = new Function('return ' + data)();
                } catch (e) {}
            }
            oldCallback && oldCallback(data||{});
        };
        mqq.invokeClient('offline', 'clearCache', params, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @function offline.disableCache
 * @desc 禁用离线包接口, 禁用状态保存在内存, 退出qq后重置
 *
 * @param {Function} callback
 * @param {Obejct} callback.result 操作结果
 *
 * @example
 * mqq.offline.disableCache(function(result){
 *     // { retcode: 0, msg: 'ok' }
 * });
 *
 * @important iOS端回调报错，但接口调用能够生效，该问题会在5.8版本修复
 * @support iOS 5.4
 * @support android 5.4
 */

mqq.build('mqq.offline.disableCache', {
    iOS: function(callback) {
        // try{
        mqq.invokeClient('offline', 'disableCache', {
            callback: mqq.callback(callback)
        });
        // } catch(e) {}
    },
    android: function(callback) {
        var oldCallback = callback;
        callback = function(data) {
            try {
                data = JSON.parse(data);
            } catch (e) {
                try {
                    data = new Function('return ' + data)();
                } catch (e) {}
            }
            oldCallback && oldCallback(data||{});
        };
        mqq.invokeClient('offline', 'disableCache', {}, callback);
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @function offline.downloadUpdate
 * @desc 直接下载并更新离线包
 *
 * @param {Object} param
 * @param {Number} param.bid
 * @param {String} param.url 更新包的url
 * @param {Function} callback
 * @param {Number} callback.ret 0更新成功，1更新失败
 * @param {String} callback.error 失败原因（成功则为null）
 * @options for callback.error 0 - 下载离线包成功
 * @options for callback.error 1 - 参数错误
 * @options for callback.error 2 - 下载更新包出错
 * @options for callback.error 3 - 没有sd卡
 * @options for callback.error 4 - 其他错误
 * @options for callback.error 5 - 暂时不需要更新，即在最小更新间隔内
 * @options for callback.error 6 - 解压失败
 * @options for callback.error 7 - 正在下载
 * @options for callback.error 8 - 暂无更新
 *
 * @important android端 QQ5.9 已废除该接口
 * @support iOS 4.6
 * @support android 4.6
 *
 */


mqq.build('mqq.offline.downloadUpdate', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback, false);
        if (callbackName) {
            params.callback = callbackName;
            mqq.invokeClient('offline', 'downloadUpdate', params);
        }
    },
    android: function(params, callback) {
        var name = mqq.callback(callback, false);
        if (params.fileSize && params.fileSize > 0) {
            mqq.invokeClient('qbizApi', 'forceUpdate', params.bid, params.url, params.fileSize, name);
        } else {
            mqq.invokeClient('qbizApi', 'forceUpdate', params.bid, params.url, name);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function offline.isCached
 * @desc 查询本地是否有指定业务的离线包
 *
 * @param {Object} param
 * @param {Number} param.bid
 * @param {Function} callback
 * @param {Number} callback.localVersion 本地离线包版本号；-1: 无离线包
 *
 * @example
 * mqq.offline.isCached({bid: 123456}, function(localVersion){
 *     if(localVersion === -1){
 *         alert("no local offline data!");
 *     }
 * });
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.offline.isCached', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
            mqq.invokeClient('offline', 'isCached', params);
        }
    },
    android: function(params, callback) {

        mqq.invokeClient('qbizApi', 'isCached', params.bid, mqq.callback(callback));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @namespace pay
 * @desc iOS的现金支付相关接口（走IAP通道，和财付通的支付没有关系）
 */

/**
 * @function pay.enablePay
 * @desc 设置界面支持的商品种类
 *
 * @param {Number} productIdArray QQ 商品ID 1 表情类 2 会员包月类
 *
 * @support iOS 4.6
 * @support android not support
 */

mqq.build('mqq.pay.enablePay', {
    iOS: function(options) {
        mqq.invokeClient('pay', 'enablePay', {
            'params': options
        });
    },
    supportInvoke: true,
    support: {
        iOS: '4.6'
    }
});
;/**
 * @function pay.pay
 * @desc 发起IOS IAP 购买请求 ,必须使用bundle id 为 com.tencent.mqq 的包来测试 ，ci包不可以购买
 *
 * @param {Object} param
 * @param {String} param.apple_pay_source 调用来源，区分不同的场景，必填非空项，业务自己定义
 * @param {Number} param.qq_product_id QQ 商品ID，1：表情类；2：会员；3：超级会员，其他业务忽略
 * @param {String} param.qq_product_name QQ 商品名字，可用于显示的名称，统一定义（已废弃，请忽略）
 * @param {String} param.app_id 数平支付的id 区分不同产品 目前表情填：1450000122 会员填：1450000299 超级会员：1450000306
 * @param {String} param.pf 平台来源，$平台-$渠道-$版本-$业务标识 例如：mobile-1234-kjava-$大厅标识 , 业务自定义的
 * @param {String} param.pfkey 跟平台来源和openkey根据规则生成的一个密钥串。内部应用填pfKey即可，不做校验
 * @param {String} param.product_id 苹果支付的商品ID, 手机QQ和sdk透传
 * @param {Number} param.product_type 0.消费类产品 1.非消费类产品 2.包月+自动续费 3.免费 4.包月+非自动续费
 * @param {Number} param.quantity 购买数量，目前填1
 * @param {Number} param.is_deposit_game_coin 是否是托管游戏币，表情商城目前不是，0
 * @param {String} param.pay_item 购买明细，业务自己控制，手机QQ和sdk透传，存在于批价和发货整个流程里,即从批价svr获取的paytoken
 * @param {String} param.var_item 这里存放业务扩展信息，如tj_plat_id=1~tj_from=vip.gongneng.xxx.xx~provider_id=1~feetype
 * @param {Number} param.disable_retry_alert 1表示禁用重试弹框，0表示不禁用。不传的话默认为0
 * @support for param.disable_retry_alert android 7.1.0
 * @support for param.disable_retry_alert iOS 7.1.0

 * @param {Function} callback 支付成功/失败的回调
 * @param {Number} callback.resultCode 错误码
 * @options for callback.resultCode -1: 未知错误
 * @options for callback.resultCode 0: 发货成功
 * @options for callback.resultCode 1: 下订单失败
 * @options for callback.resultCode 2: 支付失败
 * @options for callback.resultCode 3: 发货失败
 * @options for callback.resultCode 4: 网络错误
 * @options for callback.resultCode 5: 登录失败或无效
 * @options for callback.resultCode 6: 用户取消
 * @options for callback.resultCode 7: 用户关闭IAP支付
 * @param {String} callback.retmsg 信息+（错误码），在提示给用户信息的同时添加错误码方便定位问题。 格式如：参数错误（1001）
 *
 * @support iOS 4.6
 * @support android not support
 */

mqq.build('mqq.pay.pay', {
    iOS: function(options, callback) {
        var callbackName = callback ? mqq.callback(callback) : null;
        mqq.invokeClient('pay', 'pay', {
            'params': options,
            'callback': callbackName
        });
    },
    supportInvoke: true,
    support: {
        iOS: '4.6'
    }
});
;/**
 * @namespace redpoint
 * @desc 手Q动态Tab中的红点相关接口
 */

/**
 * @function redpoint.getAppInfo
 * @desc 获取指定path的业务信息
 *
 * @param {Object} param
 * @param {String} param.path 要查询的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径
 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为查询成功，成功时可以查看data数据字段，非0为查询失败，失败时可以看errorMessage字段的错误说明
 * @param {Object} callback.result.data 返回数据，code为0时返回，格式见note
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.getAppInfo({path:"999999.100004"}, function(result){
 *     console.log(result.code);
 *     console.log(result.data);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 * @note 回调函数返回值中data类型： { 'appID':'100004', 'iNewFlag':1, 'missions':'xxx', 'type':1, 'buffer':{ 'msg':{ '1':{ 'content':'这是一条消息', 'link':'http://vip.qq.com', 'img':'http://xxx', 'time':123456, 'stat':1 } } }, 'path':'999999.100004', 'appset':0, 'modify_ts':12353311, 'num':0 }
 */

mqq.build('mqq.redpoint.getAppInfo', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'getAppInfo', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'getAppInfo', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function redpoint.getNewMsgCnt
 * @desc 获取指定path的未读气泡消息数目
 *
 * @param {Object} param
 * @param {String} param.path 要查询的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径
 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.ret 返回码，0为查询成功，非0为查询失败
 * @param {Number} callback.result.count 未读消息数量
 *
 * @example
 * mqq.redpoint.getNewMsgCnt({path:"999999.100004"}, function(result){
 *     console.log(result.ret);
 *     console.log(result.count);
 * });
 *
 * @support iOS 4.5
 * @support android 4.5
 * @note Note 引用此方法必须保证mqq.redpoint.getAppInfo存在，并且业务方必须引入Zepto库，而且方法调用要在Zepto引入之后
 */

(function() {
    //缓存查询字符串以及url对象
    var queryString = false,
        params = {};

    /*
     * 获取查询字符串或hash中的字段值
     *
     * @param string key 要获取的字段名
     *
     * @return mixed 获取的字段名对应的值
     */
    function getQueryParams(key) {
        var val = null;
        if (queryString === false) {
            queryString = location.search == '' ? (location.hash == '' ? '' : location.hash.substring(1)) : location.search.substring(1);
            queryString = queryString.split('&');
            if (queryString.length > 0) {
                for (var i = 0; i < queryString.length; i++) {
                    val = queryString[i];
                    val = val.split('=');
                    if (val.length > 1) {
                        try {
                            params[val[0]] = decodeURIComponent(val[1]);
                        } catch (e) {
                            params[val[0]] = '';
                        }
                    }
                }
            }
        }
        return typeof params[key] != 'undefined' ? params[key] : '';
    }

    /*
     * sid，url中有则获取
     */
    var sid = getQueryParams('sid');

    /*
     * platid, ios 110， android 109， winphone 107
     */
    var platid = mqq.iOS ? 110 : (mqq.android ? 109 : 0);

    /*
     * 手机qq的版本
     */
    var qqver = mqq.QQVersion ? mqq.QQVersion : '';

    /*
     * 消息cgi的地址
     */
    var url = 'http://msg.vip.qq.com/cgi-bin/';

    /*
     * 手Q版本是否4.7及以上
     */
    var qq4_7 = (function() {
        return mqq.compare('4.7') >= 0;
    })();

    /*
     * 业务逻辑回调函数
     */
    var logicCb = {};

	/*
	* 回调函数自增ID
	*/
	var UUIDSeed = 1;

    function createUUID() {
        return 'UID_' + (++UUIDSeed);
    }


    /*
     * 发送cgi查询请求
     */
    function sendRequest(appid, callbackToken) {
        var param = {
            sid: sid,
            appid: appid.substring(appid.lastIndexOf('.') + 1),
            platid: platid,
            qqver: qqver,
            format: 'json',
            _: new Date().getTime()
        };
        var uri = 'get_new_msg_cnt';

        try {
            Zepto.ajax({
                type: 'get',
                url: url + uri,
                dataType: 'json',
                data: param,
                timeout: 10000,
                success: function(json) {
                    var ret = {
                        ret: json.ecode,
                        count: 0
                    };

                    if (json.ecode == 0) {
                        ret.count = json.new_msg_cnt;
                    }

                    logicCb[callbackToken].call(null, ret);
					delete logicCb[callbackToken];
                },
                error: function() {
					logicCb[callbackToken].call(null, {
                        ret: -1,
                        list: []
                    });
					delete logicCb[callbackToken];
                }
            });
        } catch (e) {
            logicCb[callbackToken].call(null, {
				ret: -2,
				list: []
			});
			delete logicCb[callbackToken];
        }
    }

    /*
     * 获取并返回消息列表
     */
    function getMsgList(json, callbackToken) {
        if (json.code == 0) { //正常
            var ret = {
                ret: json.code,
                count: 0
            };
            var list = json.data.buffer;
            var arr = [];

            list = (typeof list != 'object' && list != '') ? JSON.parse(list) : list;

            if (typeof list.msg != 'undefined') {
                for (var i in list.msg) {
                    if (list.msg[i].stat == 1) {
                        ret.count++;
                    }
                }

            }
            logicCb[callbackToken].call(null, ret);
        } else {
			logicCb[callbackToken].call(null, {
                ret: json.code,
                list: []
            });
        }
		delete logicCb[callbackToken];
    }

    mqq.build('mqq.redpoint.getNewMsgCnt', {
        iOS: function(params, callback) {
            appid = String(params.path);
            var callbackToken = createUUID();
            logicCb[callbackToken] = callback;

            if (qq4_7) {
                mqq.redpoint.getAppInfo(params, function(json){
					getMsgList(json, callbackToken);
				});
            } else {
                if (!Zepto) { //zepto不存在，直接返回错误
                    typeof callback == 'function' ? callback({
                        ret: -10000,
                        count: 0
                    }) : null;
                    return;
                }
                sendRequest(appid, callbackToken);
            }
        },
        android: function(params, callback) {
            appid = String(params.path);
            var callbackToken = createUUID();
            logicCb[callbackToken] = callback;

            if (qq4_7) {
                mqq.redpoint.getAppInfo(params, function(json){
					getMsgList(json, callbackToken);
				});
            } else {
                if (!Zepto) { //zepto不存在，直接返回错误
                    typeof callback == 'function' ? callback({
                        ret: -10000,
                        count: 0
                    }) : null;
                    return;
                }
                sendRequest(appid, callbackToken);
            }
        },
        supportInvoke: true,
    support: {
            iOS: '4.5',
            android: '4.5'
        }
    });
})();
;/**
 * @function redpoint.getNewMsgList
 * @desc 获取当前path下的所有未读气泡消息列表，当调用此方法后，即认为拉出来的消息为用户已读
 *
 * @param {Object} param
 * @param {String} param.path 要查询的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径
 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.ret 返回码，0为查询成功，非0为查询失败
 * @param {Array} callback.result.list 未读消息列表，code为0时返回
 * @param {String} callback.result.list.title 消息标题
 * @param {String} callback.result.list.content 消息内容
 * @param {String} callback.result.list.img 消息配图的url
 * @param {String} callback.result.list.link 消息要跳转的目标url
 * @param {String} callback.result.list.pubTime 消息发布的时间
 * @param {String} callback.result.list.src 消息来源
 * @param {String} callback.result.list.ext1 扩展字段1
 * @param {String} callback.result.list.ext2 扩展字段2
 * @param {String} callback.result.list.ext3 扩展字段3
 * @param {Number} callback.result.list.id 消息id
 *
 * @example
 * mqq.redpoint.getNewMsgList({path:"999999.100004"}, function(result){
 *     console.log(result.ret);
 *     for(var i = 0; i < result.list.length; i++){
 *         console.log(result.list[i].content)
 *     }
 * });
 *
 * @support iOS 4.5
 * @support android 4.5
 * @note 引用此方法必须保证mqq.redpoint.getAppInfo存在，并且业务方必须引入Zepto库，而且方法调用要在Zepto引入之后
 */

(function() {
    //缓存查询字符串以及url对象
    var queryString = false,
        params = {};

    /*
     * 获取查询字符串或hash中的字段值
     *
     * @param string key 要获取的字段名
     *
     * @return mixed 获取的字段名对应的值
     */
    function getQueryParams(key) {
        var val = null;
        if (queryString === false) {
            queryString = location.search == '' ? (location.hash == '' ? '' : location.hash.substring(1)) : location.search.substring(1);
            queryString = queryString.split('&');
            if (queryString.length > 0) {
                for (var i = 0; i < queryString.length; i++) {
                    val = queryString[i];
                    val = val.split('=');
                    if (val.length > 1) {
                        try {
                            params[val[0]] = decodeURIComponent(val[1]);
                        } catch (e) {
                            params[val[0]] = '';
                        }
                    }
                }
            }
        }
        return typeof params[key] != 'undefined' ? params[key] : '';
    }

    /**
     * sid，url中有则获取
     */
    var sid = getQueryParams('sid');

    /**
     * platid, ios 110， android 109， winphone 107
     */
    var platid = mqq.iOS ? 110 : (mqq.android ? 109 : 0);

    /**
     * 手机qq的版本
     */
    var qqver = mqq.QQVersion ? mqq.QQVersion : '';

    /**
     * 消息cgi的地址
     */
    var url = 'http://msg.vip.qq.com/cgi-bin/';

    /**
     * 手Q版本是否4.7及以上
     */
    var qq4_7 = (function() {
        return mqq.compare('4.7') >= 0;
    })();

    /**
     * 业务逻辑回调函数
     */
    var logicCb = {};

	/**
	* 回调函数自增ID
	*/
	var UUIDSeed = 1;

    function createUUID() {
        return 'UID_' + (++UUIDSeed);
    }

    /**
     * 发送cgi查询请求
     */
    function sendRequest(appid, callbackToken) {
        var param = {
            sid: sid,
            appid: appid.substring(appid.lastIndexOf('.') + 1),
            platid: platid,
            qqver: qqver,
            format: 'json',
            _: new Date().getTime()
        };
        var uri = 'read_msg';

        try {
            Zepto.ajax({
                type: 'get',
                url: url + uri,
                dataType: 'json',
                data: param,
                timeout: 10000,
                success: function(json) {
                    var ret = {
                        ret: json.ecode,
                        list: []
                    };
                    if (json.ecode == 0) {
                        var list = json.msg,
                            arr = [];
                        for (var i in list) {
                            arr.push({
                                content: list[i].content ? list[i].content : '',
                                link: list[i].link ? list[i].link : '',
                                img: list[i].img ? list[i].img : '',
                                pubTime: list[i].time ? list[i].time : '',
                                title: list[i].title ? list[i].title : '',
                                src: list[i].src ? list[i].src : '',
                                ext1: list[i].ext1 ? list[i].ext1 : '',
                                ext2: list[i].ext2 ? list[i].ext2 : '',
                                ext3: list[i].ext3 ? list[i].ext3 : '',
                                id: i
                            });
                        }
                        ret.list = arr;
                    }
                    logicCb[callbackToken].call(null, ret);
					delete logicCb[callbackToken];
                },
                error: function() {
					logicCb[callbackToken].call(null, {
                        ret: -1,
                        list: []
                    });
					delete logicCb[callbackToken];
                }
            });
        } catch (e) {
            logicCb[callbackToken].call(null, {
				ret: -2,
				list: []
			});
			delete logicCb[callbackToken];
        }
    }


    /**
     * 获取并返回消息列表
     */
    function getMsgList(json, callbackToken) {
        if (json.code == 0) { //正常
            var ret = {
                ret: json.code,
                list: []
            };
            var list = json.data.buffer;
            var arr = [];

            list = (typeof list != 'object' && list != '') ? JSON.parse(list) : list;

            if (typeof list.msg != 'undefined') {
                for (var i in list.msg) {
                    if (list.msg[i].stat == 1) {
                        arr.push({
                            content: list.msg[i].content ? list.msg[i].content : '',
                            link: list.msg[i].link ? list.msg[i].link : '',
                            img: list.msg[i].img ? list.msg[i].img : '',
                            pubTime: list.msg[i].time ? list.msg[i].time : '',
                            title: list.msg[i].title ? list.msg[i].title : '',
                            src: list.msg[i].src ? list.msg[i].src : '',
                            ext1: list.msg[i].ext1 ? list.msg[i].ext1 : '',
                            ext2: list.msg[i].ext2 ? list.msg[i].ext2 : '',
                            ext3: list.msg[i].ext3 ? list.msg[i].ext3 : '',
                            id: i
                        });
                        //因为获取消息列表需要将消息设置为已读，所以此处将消息的stat设置为2，已读
                        list.msg[i].stat = 2;
                    }
                }
                json.data.buffer = JSON.stringify(list);

                if (arr.length > 0) {
                    ret.list = arr;
                    //因为获取消息列表需要将消息设置为已读，所以此处先回调，将消息的stat设置为2，已读
                    mqq.redpoint.setAppInfo({
                        appInfo: json.data
                    }, function(json) {
                        console.log(JSON.stringify(json));
                    });
                    var appid = json.data.appID;
                    //因为目前手Q4.7不会即时上报消息被拉取，所以这里发请求拉取cgi，通知服务器消息已被拉取
                    var param = {
                        sid: sid,
                        appid: appid,
                        platid: platid,
                        qqver: qqver,
                        format: 'json',
                        _: new Date().getTime()
                    };
                    var uri = 'read_msg';
                    try {
                        Zepto.ajax({
                            type: 'get',
                            url: url + uri,
                            dataType: 'json',
                            data: param,
                            timeout: 10000,
                            success: function(json) {},
                            error: function() {}
                        });
                    } catch (e) {}
                }
            }
			logicCb[callbackToken].call(null, ret);
        } else {
			logicCb[callbackToken].call(null, {
                ret: json.code,
                list: []
            });
        }
		delete logicCb[callbackToken];
    }

    mqq.build('mqq.redpoint.getNewMsgList', {
        iOS: function(params, callback) {
            appid = String(params.path);
			var callbackToken = createUUID();
            logicCb[callbackToken] = callback;

            if (qq4_7) {
                mqq.redpoint.getAppInfo(params, function(json){
					getMsgList(json, callbackToken);
				});
            } else {
                if (!Zepto) { //zepto不存在，直接返回错误
                    typeof callback == 'function' ? callback({
                        ret: -10000,
                        count: 0
                    }) : null;
                    return;
                }
                sendRequest(appid, callbackToken);
            }
        },
        android: function(params, callback) {
            appid = String(params.path);
            var callbackToken = createUUID();
            logicCb[callbackToken] = callback;

            if (qq4_7) {
                mqq.redpoint.getAppInfo(params, function(json){
					getMsgList(json, callbackToken);
				});
            } else {
                if (!Zepto) { //zepto不存在，直接返回错误
                    typeof callback == 'function' ? callback({
                        ret: -10000,
                        count: 0
                    }) : null;
                    return;
                }
                sendRequest(appid, callbackToken);
            }
        },
        supportInvoke: true,
    support: {
            iOS: '4.5',
            android: '4.5'
        }
    });
})();
;/**
 * @function redpoint.getRedPointShowInfo
 * @desc 获取指定path或set的红点信息
 *
 * @param {Object} param
 * @param {String} param.path 要查询的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径
 * @param {String} param.set 要查询的红点的set，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径
 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为查询成功，成功时可以查看data数据字段，非0为查询失败，失败时可以看errorMessage字段的错误说明
 * @param {Object} callback.result.data 返回数据，code为0时返回
 * @param {Number} callback.result.data.hintType 0为小红点，1为数字红点，2为new红点
 * @param {Number} callback.result.data.number 如果是数字红点，则表示红点数目
 * @param {Number} callback.result.data.isShow 是否展示红点，1则表示展示，0表示不展示
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.getRedPointShowInfo({path:"999999.100004"}, function(result){
 *     console.log(result.code);
 *     console.log(result.data);
 *     console.log(result.errorMessage);
 * });
 * mqq.redpoint.getRedPointShowInfo({set:"00001"}, function(result){
 *     console.log(result.code);
 *     console.log(result.data);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 * @note path和set中优先取set，set不存在则取path，二者必须保证有一个存在
 */

mqq.build('mqq.redpoint.getRedPointShowInfo', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'getRedPointShowInfo', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'getRedPointShowInfo', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function redpoint.isEnterFromRedPoint
 * @desc 判断当前访问是否属于红点引流
 *
 * @param {Object} param
 * @param {String} param.path 业务对应的红点appid，由红点后台分配，需联系红点后台负责人，此处需传入全路径，如999999.100004
 * @param {Function} callback 查询成功/失败的回调
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为查询成功，成功时可以查看data数据字段，非0为查询失败，失败时可以看errorMessage字段的错误说明
 * @param {Number} callback.result.data 标记位，0则非红点引流，1则属于红点引流
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.isEnterFromRedPoint({path:"100400"}, function(result){
 *     console.log(result.code);
 *     console.log(result.data);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 5.4
 * @support android 5.4
 */
mqq.build('mqq.redpoint.isEnterFromRedPoint', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback, true);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'isEnterFromRedPoint', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback, true);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'isEnterFromRedPoint', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @function redpoint.reportBusinessRedTouch
 * @desc 上报手Q业务红点投放效果
 *
 * @param {Object} param
 * @param {String} param.path 业务对应的红点appid，由红点后台分配，需联系红点后台负责人，此处需传入全路径，如999999.100004
 * @param {Number} param.service_type 业务类型
 * @options for param.service_type 0: 付费类
 * @options for param.service_type 1: APP类
 * @options for param.service_type 2: 活跃类
 * @param {Number} param.service_id 业务对应的第一级红点appid
 * @param {Number} param.act_id 操作ID，其它操作ID请联系heavencui分配
 * @options for param.act_id 1001: 曝光
 * @options for param.act_id 1002: 点击
 * @options for param.act_id 2001: 下载
 * @options for param.act_id 2002: 启动
 * @options for param.act_id 3001: 付费
 * @param {String} param.obj_id 操作对象ID，例如下载游戏的id、付费业务的id，业务自定义
 * @param {Number} param.pay_amt 付费金额，单位为分，不涉及金额则填0
 * @param {Function} callback 上报成功/失败的回调
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为上报成功，非0为上报失败，失败时可以看errorMessage字段的错误说明
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.reportBusinessRedTouch({path:"100400", service_type: 0, service_id: 100400, act_id: 1001, obj_id: "1", pay_amt: 0}, function(result){
 *     console.log(result.code);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 5.4
 * @support android 5.4
 * @note 引用此方法必须保证mqq.redpoint.isEnterFromRedPoint存在
 */
;(function() {
    var _handler = function(params, callback) {
        if (typeof callback != 'function') {
            callback = function(result) {}
        }
        // 检测上报参数是否正确赋值
        var checkList = ['path', 'service_type', 'service_id', 'act_id', 'obj_id', 'pay_amt'];
        for (var i = 0, len = checkList.length; i < len; ++i) {
            if (typeof params[checkList[i]] == 'undefined') {
                callback({
                    code: -1,
                    errorMessage: 'params invalid'
                });

                callback = null;
                return false;
            }
        }

        // 检测是点击红点进入才上报
        mqq.redpoint.isEnterFromRedPoint({path: params.path}, function(result){
            if (result.code == 0 && result.data == 1) {
                if (callback) {
                    params.callback = mqq.callback(callback, true);
                }
                mqq.invokeClient('redpoint', 'reportBusinessRedTouch', params);
            } else {
                callback({
                    code: -1,
                    errorMessage: result.errorMessage
                });
                params = null;
                callback = null;
            }
        });
    };
    mqq.build('mqq.redpoint.reportBusinessRedTouch', {
        iOS: _handler,
        android: _handler,
        supportInvoke: true,
    support: {
            iOS: '5.4',
            android: '5.4'
        }
    });
})();
;/**
 * @function redpoint.reportRedTouch
 * @desc 主动上报红点点击信息，因为红点默认需要激活app或登录时才会拉取和上报，通过此消息可主动上报
 *
 * @param {Object} param
 * @param {String} param.path 要上报的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径

 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为上报成功，非0为上报失败，失败时可以看errorMessage字段的错误说明
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.reportRedTouch({path:"999999.100004"}, function(result){
 *     console.log(result.code);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 */

mqq.build('mqq.redpoint.reportRedTouch', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'reportRedTouch', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'reportRedTouch', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function redpoint.setAppInfo
 * @desc 设置指定path的业务信息
 *
 * @param {Object} param
 * @param {String} param.path 要设置的红点的path，由红点后台系统分配，具体可联系红点后台负责人jackxu或samzou，如果是子业务则必须传入全路径

 * @param {Function} callback
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.code 返回码，0为设置成功，非0为设置失败，失败时可以看errorMessage字段的错误说明
 * @param {String} callback.result.errorMessage 错误信息，code非0时返回
 *
 * @example
 * mqq.redpoint.setAppInfo({appInfo:appInfo}, function(result){
 *     console.log(result.code);
 *     console.log(result.errorMessage);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 * @note appInfo为mqq.redpoint.getAppInfo返回的对象，对象格式见mqq.redpoin.getAppInfo说明
 */

mqq.build('mqq.redpoint.setAppInfo', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'setAppInfo', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('redpoint', 'setAppInfo', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @namespace sensor
 * @desc 传感器相关接口
 */

/**
 * @function sensor.getLocation
 * @desc 获取经纬度座标，这里返回的都是火星坐标，业务需要进行转换，可以使用腾讯地图的API查询验证：http://lbs.qq.com/uri_v1/guide-geocoder.html，如：http://apis.map.qq.com/uri/v1/geocoder?coord=22.543783,113.928937&coord_type=1，coord_type需指定为 gps（也就是火星坐标）。
 *
 * @param {Object} [options] 配置参数
 * @param {Number} options.allowCacheTime 读取多少时间内的缓存定位数据，以秒为单位
 * @support for options iOS 5.5
 * @support for options android 5.5
 * @param {Function} callback 回调函数
 * @param {Number} callback.ret 0:成功; -1: 失败
 * @param {Number} callback.latitude
 * @param {Number} callback.longitude
 * @param {Object} callback.status
 * @param {Boolean} callback.status.enabled 是否已开启传感器
 * @param {Boolean} callback.status.authroized 是否已授权
 * @support for callback.status iOS 4.7
 * @support for callback.status android not support
 *
 * @example
 * // 读取60s内的缓存数据
 * mqq.sensor.getLocation({allowCacheTime:60}, function(retCode, latitude, longitude){
 *     alert("retCode: " + retCode + " " + latitude + ", " + longitude);
 * });
 *
 * @example
 * // 重新定位
 * mqq.sensor.getLocation(function(retCode, latitude, longitude){
 *     alert("retCode: " + retCode + " " + latitude + ", " + longitude);
 * });
 *
 * @support iOS 4.5
 * @support android 4.6
 *
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.getLocation', {
    iOS: function(options) {

        var cb = arguments[arguments.length-1];
        var opts = typeof options === 'object' ? options : {};

        if ( typeof cb === 'function' ) {
            opts.callback = mqq.callback(cb)
        }

        return mqq.invokeClient('data', 'queryCurrentLocation', opts);
    },
    android: function(options) {
        var cb = arguments[arguments.length-1];
        var opts = typeof options === 'object' ? options : {};
        var callbackName = mqq.callback(function(result) {
            var retCode = -1,
                longitude = null,
                latitude = null;
            if (result && result !== 'null') {
                result = (result + '').split(',');
                if (result.length === 2) {
                    retCode = 0; // 获取的是经纬度

                    longitude = parseFloat(result[0] || 0);
                    latitude = parseFloat(result[1] || 0);
                }else{
                    retCode = result[0]; // 错误码，-3代表未授权，-4代表客户端调用出错
                }
            }
            cb(retCode, latitude, longitude);
        }, true);

        if ( typeof cb === 'function' ) {
            opts.callback = callbackName
        }

        mqq.invokeClient('publicAccount', 'getLocation', mqq.compare('5.5') > -1 ? opts : callbackName);
    },
    browser: function() {
        var cb = arguments[arguments.length-1];
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function(position) {

                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;

                cb(0, latitude, longitude);
            }, function( /*error*/ ) {
                // switch (error.code) {
                // case 0:
                //     alert(“尝试获取您的位置信息时发生错误：” + error.message);
                //     break;
                // case 1:
                //     alert(“用户拒绝了获取位置信息请求。”);
                //     break;
                // case 2:
                //     alert(“浏览器无法获取您的位置信息。”);
                //     break;
                // case 3:
                //     alert(“获取您位置信息超时。”);
                //     break;
                // }
                cb(-1);
            });
        } else {
            cb(-1);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6',
        browser: '0'
    }
});
;/**
 * @function sensor.getRealLocation
 * @desc 获取地理位置
 *
 * @param {Object} param
 * @param {Number} param.desiredAccuracy 地理位置精度，默认2
 * @options for param.desiredAccuracy 1-best
 * @options for param.desiredAccuracy 2-100m
 * @options for param.desiredAccuracy 3-1000m
 * @options for param.desiredAccuracy 4-3000m
 *
 * @param {Number} param.isWGS84 地理位置精度，默认1
 * @options for param.isWGS84 0-火星座标
 * @options for param.isWGS84 1-地球座标
 *
 * @param {Number} param.showAlert 当系统定位关闭时，回调函数的retCode会返回-1，此参数用于控制是否弹出alert询问用户是否打开定位，默认1
 * @options for param.showAlert 0-不弹框
 * @options for param.showAlert 1-弹框
 *
 * @param {function} callback 回调
 * @param {Number} callback.retCode 返回码
 * @options for callback.retCode -1 : 获取位置失败
 * @options for callback.retCode  0 : 获取经纬度成功
 *
 * @param {Object} callback.result 返回数据
 * @param {Number} callback.result.desiredAccuracy 精度
 * @param {Number} callback.result.lat 经度
 * @param {Number} callback.result.lon 维度
 * @param {Number} callback.result.isWGS84 是(1)否(0)火星座标
 * @param {Number} callback.timestamp 时间戳
 *
 * @support iOS 4.6
 * @support android 4.6
 *
 * @discard 1
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.getRealLocation', {
    iOS: function(params, callback) {
        var callbackName = callback ? mqq.callback(callback) : null;
        return mqq.invokeClient('data', 'getOSLocation', {
            'params': params,
            'callback': callbackName
        });
    },
    android: function(params, callback) {
        params = JSON.stringify(params || {});
        mqq.invokeClient('publicAccount', 'getRealLocation', params,
            mqq.callback(callback, true));
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function sensor.getSensorStatus
 * @desc 查询传感器状态，检测用户是否允许调用相关传感器接口。android 不需要。
 *
 * @param {String} type 传感器类型，目前只有 'gps'
 * @param {Function} callback 回调函数
 * @param {Number} callback.ret 0:成功; -1: 失败
 * @param {Object} callback.status
 * @param {Boolean} callback.status.enabled 是否已开启传感器
 * @param {Boolean} callback.status.authroized 是否已授权
 *
 * @support iOS 4.7
 * @support android not support
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.getSensorStatus', {
    iOS: function(params, callback) {
        params = params || {
            type: 'gps'
        };
        params.callbackName = mqq.callback(callback);
        mqq.invokeClient('sensor', 'getSensorStatus', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7'
    }
});
;/**
 * @function sensor.startAccelerometer
 * @desc 开始监听重力感应数据，回调会获得三个轴的数值，监听频率 50次/秒
 *
 * @param {Function} callback 回调函数
 * @param {Boolean} callback.ret 是否成功启动传感器
 * @param {Number} callback.x
 * @param {Number} callback.y
 * @param {Number} callback.z
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.startAccelerometer', {
    iOS: function(callback) {
        var callbackName = mqq.callback(callback, false, true);
        if (callbackName) {
            mqq.invokeClient('sensor', 'startAccelerometer', {
                'callback': callbackName
            });
        }
    },
    android: function(callback) {
        var name = mqq.callback(callback, false, true);
        mqq.invokeClient('qbizApi', 'startAccelerometer', name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.startCompass
 * @desc 开始监听罗盘数据
 *
 * @param {Function} callback 回调函数
 * @param {Boolean} callback.ret 是否成功启动传感器
 * @param {Number} callback.direction 面对的方向度数，频率50次/秒
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.startCompass', {
    iOS: function(callback) {
        var callbackName = mqq.callback(callback, false, true);
        if (callbackName) {
            mqq.invokeClient('sensor', 'startCompass', {
                'callback': callbackName
            });
        }
    },
    android: function(callback) {
        var name = mqq.callback(callback, false, true);
        mqq.invokeClient('qbizApi', 'startCompass', name);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.startListen
 * @desc 开始监听麦克风音量
 *
 * @param {Function} callback 回调函数
 * @param {Boolean} callback.ret 是否成功启动传感器
 * @param {Number} callback.volume 音量大小(db)，回调频率10次/秒，该值最大不找过100（因终端使用int类型，超过会溢出）
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 *
 * @important 这个接口是静默的，调用后用户无感知，最好 UI 给予用户提示页面将监听麦克风音量变化。
 */

mqq.build('mqq.sensor.startListen', {
    iOS: function(callback) {
        var callbackName = mqq.callback(callback, false, true);

        if (callbackName) {
            mqq.invokeClient('sensor', 'startListen', {
                callback: callbackName
            });
        }
    },
    android: function(callback) {
        var name = mqq.callback(callback, false, true);

        mqq.invokeClient('qbizApi', 'startListen', name);

    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.stopAccelerometer
 * @desc 停止监听重力感应数据
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.stopAccelerometer', {
    iOS: function() {
        mqq.invokeClient('sensor', 'stopAccelerometer');
    },
    android: function() {
        mqq.invokeClient('qbizApi', 'stopAccelerometer');
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.stopCompass
 * @desc 停止监听罗盘数据
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.stopCompass', {
    iOS: function() {
        mqq.invokeClient('sensor', 'stopCompass');
    },
    android: function() {
        mqq.invokeClient('qbizApi', 'stopCompass');
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.stopListen
 * @desc 停止监听麦克风音量大小
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.stopListen', {
    iOS: function() {
        mqq.invokeClient('sensor', 'stopListen');
    },
    android: function() {
        mqq.invokeClient('qbizApi', 'stopListen');
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }

});
;/**
 * @function sensor.vibrate
 * @desc 让手机震动一下
 *
 * @param {Object} param
 * @param {Number} param.time 毫秒，android可以指定震动时间，iOS的震动时间是系统管理的，不能指定
 *
 * @support iOS 4.6
 * @support android 4.6
 * @care 泄漏用户传感器信息
 */

mqq.build('mqq.sensor.vibrate', {
    iOS: function(params) {
        params = params || {};
        mqq.invokeClient('sensor', 'vibrate', params);
    },
    android: function(params) {
        params = params || {};
        mqq.invokeClient('qbizApi', 'phoneVibrate', params.time);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @namespace tenpay
 * @desc 支付相关接口
 */

/**
 * @function tenpay.buyGoods
 * @developer TEG\225计费平台部\支付平台中心\终端支付组 [ios]bladebao [android]brodychen
 * @desc 购买道具
 *
 * @param {Object} param
 * @param {String} param.offerId 必须设置。offerId可以在http://cpay.qq.com/jr申请
 * @param {String} param.userId 用户的id，QQ号码用于验证和当前登录用户是否匹配（必选字段）
 * @param {String} param.tokenUrl 应用侧在唤起购买SDK前，应用后台在数平侧下的订单Url
 * @param {String} [param.aid] 标记业务来源：格式如vip.pingtai.vipsite.index
 * @param {String} [param.zoneId] 游戏服务器大区id，游戏不分大区则默认zoneId =“1”
 * @param {Boolean} [param.numberVisible] 是否显示购买数量
 * @param {String} [param.unit] 显示的单位量词，比如传递"个"，"张"(可选字段，默认为"月")
 * @support for param.unit iOS not support
 * @support for param.unit Android 4.7
 * @param {String} [param.discountId] 基于该平台可以通过配置MP单进行营销活动开发，同开通相关的主要是，在支付时传入MP单号，计费平台部会在开通成功后根据该MP单号，赠送MP单对应的配置物品
 * @support for param.discountId iOS 5.2
 * @support for param.discountId Android 5.2
 * @param {String} [param.other] 预留接口
 * @support for param.other iOS 5.2
 * @support for param.other Android 5.2

 * @param {Function} callback
 * @param {Function} callback.result

 * @param {Number} callback.result.resultCode 回调到应用时，应用侧先检查resultCode，如果为 0 则可以继续检查是否支付成功和发货成功否则表明用户未支付或者支付出错。
 * @options for callback.result.resultCode -1: 支付流程失败
 * @options for callback.result.resultCode 0: 支付流程成功
 * @options for callback.result.resultCode 2: 用户取消

 * @param {Number} callback.result.realSaveNum 购买成功时购买的数量
 * @param {Number} callback.result.payChannel 支付渠道，只有支付成功时才返回相应的支付渠道
 * @options for callback.result.payChannel -1: 未知
 * @options for callback.result.payChannel 0: Q点渠道
 * @options for callback.result.payChannel 1: 财付通
 * @options for callback.result.payChannel 2: 银行卡支付
 * @options for callback.result.payChannel 3: 银行卡快捷支付
 * @options for callback.result.payChannel 4: Q卡渠道
 * @options for callback.result.payChannel 5: 手机充值卡渠道
 * @options for callback.result.payChannel 6: 话费渠道
 * @options for callback.result.payChannel 7: 元宝渠道
 * @options for callback.result.payChannel 8: 微信支付渠道

 * @param {Number} callback.result.payState 支付状态
 * @options for callback.result.payState -1: 支付状态未知
 * @options for callback.result.payState 0: 支付成功
 * @options for callback.result.payState 1: 用户取消
 * @options for callback.result.payState 2: 支付出错

 * @param {Number} callback.result.provideState 发货状态
 * @options for callback.result.provideState -1: 无法知道是否发货成功，如：财付通、手机充值卡渠道
 * @options for callback.result.provideState 0: 发货成功
 * @param {String} callback.result.resultMsg 返回信息
 * @param {String} callback.result.extendInfo 扩展信息
 * @param {String} callback.result.payReserve1 保留字1
 * @param {String} callback.result.payReserve2 保留字2
 * @param {String} callback.result.payReserve3 保留字3
 *
 * @support iOS 6.5.0
 * @support android 4.6.1
 * @note 由于存在一些支付渠道（如手机充值卡、财付通）不是实时到账，无法确定是否发货成功，只能知道支付是否成功。（只有个帐和Q卡渠道是实时到账）
 * @change v4.7: 增加 unit 参数
 */
mqq.build('mqq.tenpay.buyGoods', {
    android: function(params, callback) {
        mqq.invokeClient('pay', 'buyGoods', JSON.stringify(params), callback);
    },
    iOS: function(params, callback) {
        mqq.invokeClient('pay', 'buyGoods', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '4.6.1',
        iOS: '6.5.0'
    }
});
;/**
 * @function tenpay.isOpenSecurityPay
 * @desc 判断手机管家的支付保护是否打开，支付保护功能需要安装手机管家并从手Q页面进行设置

 * @param {Function} callback
 * @param {Function} callback.result 返回的数据对象

 * @param {Boolean} callback.result.isSecurityPayOpen 是(true)否(false)已打开手机管家的支付保护
 *
 * @support iOS not support
 * @support android 5.3
 */
mqq.build('mqq.tenpay.isOpenSecurityPay', {

    android: function(params, callback) {
        var params = {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('qw_charge', 'qqpimsecure_safe_isopen_securitypay', params);
    },
    supportInvoke: true,
    support: {
        android: '5.3.0'
    }
});

;/**
 * @function tenpay.openService
 * @desc 开通包月服务接口
 *
 * @param {Object} param
 * @param {String} param.offerId 必须设置。offerId可以在http://cpay.qq.com/jr申请
 * @param {String} param.userId 用户的id，QQ号码用于验证和当前登录用户是否匹配
 * @param {String} param.serviceCode 需要开通业务的业务代码，如LTMCLUB
 * @param {String} param.serviceName 需要开通业务的业务名称，将会显示在sdk Tittle栏
 * @param {String} [param.channel] 其他渠道暂时不支持指定渠道支付。
 * @options for param.channel "bank" - 银行卡快捷支付
 * @options for param.channel "wechat" - 微信支付
 * @note for param.channel 如果要取消指定渠道，则channel传递空串或者null即可。
 * @note for param.channel 如果游戏中调用该方法并支付后，要调用正常的支付流程，请将参数设置为空或者null。

 * @param {String} [param.unit] unit显示的单位量词，比如传递"个"，"张"(默认为"月")
 * @param {String} [param.openMonth] 开通月份
 * @param {Boolean} [param.isCanChange] 购买数量是否可改
 * @param {String} [param.aid] 业务来源：如vip.pingtai.vipsite.index，同tenpay.buyGoods
 * @param {String} [param.remark] sdk会透传给portal和二级boss，对应portal的payremark字段，可以填空或者空值。如果传了remark字段，流水会记录remark的内容；如果remark为空，流水记录pf（包含aid）的内容。
 * @param {String} param.discountId 基于该平台可以通过配置MP单进行营销活动开发，同开通相关的主要是，在支付时传入MP单号，计费平台部会在开通成功后根据该MP单号，赠送MP单对应的配置物品
 * @support for param.discountId not support
 * @support for param.discountId Android 5.2

 * @param {String} param.provideUin 被赠送人号码。
 * @support for param.provideUin not support
 * @support for param.provideUin Android 5.2

 * @param {String} param.provideType 发货类型，跟登录的userId有关系，如果userId 是QQ号码，如userId = “281348406”(QQ号)，则provideType的值是“uin”；如果userId 是openid的形式，例如userId = “559B3E350A3AC6EB5CA98068AE5BA451”（openid），则provideType的值是“openid”。
 * @support for param.provideType not support
 * @support for param.provideType Android 5.2

 * @param {String} [param.other] 预留接口
 * @support for param.other not support
 * @support for param.other Android 5.2

 * @param {Function} callback
 * @param {Function} callback.result

 * @param {Number} callback.result.resultCode 回调到应用时，应用侧先检查resultCode，如果为 0 则可以继续检查是否支付成功和发货成功否则表明用户未支付或者支付出错。
 * @options for callback.result.resultCode -1: 支付流程失败
 * @options for callback.result.resultCode 0: 支付流程成功
 * @options for callback.result.resultCode 2: 用户取消

 * @param {Number} callback.result.realSaveNum 购买成功时购买的数量
 * @param {Number} callback.result.payChannel 支付渠道，只有支付成功时才返回相应的支付渠道
 * @options for callback.result.payChannel -1: 未知
 * @options for callback.result.payChannel 0: Q点渠道
 * @options for callback.result.payChannel 1: 财付通
 * @options for callback.result.payChannel 2: 银行卡支付
 * @options for callback.result.payChannel 3: 银行卡快捷支付
 * @options for callback.result.payChannel 4: Q卡渠道
 * @options for callback.result.payChannel 5: 手机充值卡渠道
 * @options for callback.result.payChannel 6: 话费渠道
 * @options for callback.result.payChannel 7: 元宝渠道
 * @options for callback.result.payChannel 8: 微信支付渠道

 * @param {Number} callback.result.payState 支付状态
 * @options for callback.result.payState -1: 支付状态未知
 * @options for callback.result.payState 0: 支付成功
 * @options for callback.result.payState 1: 用户取消
 * @options for callback.result.payState 2: 支付出错

 * @param {Number} callback.result.provideState 发货状态
 * @options for callback.result.provideState -1: 无法知道是否发货成功，如：财付通、手机充值卡渠道
 * @options for callback.result.provideState 0: 发货成功
 * @param {String} callback.result.resultMsg 返回信息
 * @param {String} callback.result.extendInfo 扩展信息
 * @param {String} callback.result.payReserve1 保留字1
 * @param {String} callback.result.payReserve2 保留字2
 * @param {String} callback.result.payReserve3 保留字3
 *
 * @support iOS 5.7
 * @support android 4.6.1
 * @note 由于存在一些支付渠道（如手机充值卡、财付通）不是实时到账，无法确定是否发货成功，只能知道支付是否成功。（只有个帐和Q卡渠道是实时到账）
 */
mqq.build('mqq.tenpay.openService', {

	iOS: function(params, callback) {
        mqq.invokeClient('pay', 'openService', JSON.stringify(params), callback);
    },
    android: function(params, callback) {
        mqq.invokeClient('pay', 'openService', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        iOS: '5.7',
        android: '4.6.1'
    }
});
;/**
 * @function tenpay.openTenpayView
 * @desc 购买道具
 *
 * @param {Object} param
 * @param {String} param.userId 用户的id，QQ号码用于验证和当前登录用户是否匹配（必选字段）
 * @param {String} param.viewTag 打开的页面名称，支持下面四个选项
 * @options for param.viewTag bindNewCard 绑卡流程界面
 * @options for param.viewTag balance （Android 手Q4.7.2）查看用户余额信息界面
 * @options for param.viewTag pswManage （Android 手Q5.1）支付密码管理界面
 * @options for param.viewTag checkPsw （Android 手Q5.2）独立密码验证

 * @param {String} param.bargainor_id 商户号，当viewTag= bindNewCard时，必填
 * @param {String} param.app_id 生活服务帐号标识：appid–即生活服务号uin（如果无生活服务uin的情况，请咨询增值渠道部分配appid）
 * @param {String} param.channel 渠道：channel，目前分配wallet(钱包),account(生活服务帐号),dongtai(动态),qun(群),huodong（活动），如有新渠道后面新添加,或咨询增值渠道部。
 * @param {String} param.appInfo 标记业务及渠道，用来统计各业务KPI完成度，同tenpay.pay，注：该参数iOS在5.4.1之前无法正常使用。
 * @support for param.appInfo iOS 5.4.1
 * @support for param.appInfo android 4.6.1

 * @param {String} param.extra_data 附加参数
 * @support for param.extra_data iOS not support
 * @support for param.extra_data android 5.2


 * @param {Function} callback
 * @param {Object} callback.result

 * @param {Number} callback.result.resultCode 0 ： 表示成功。非0：表示失败
 * @param {String} callback.result.retmsg 表示调用结果信息字符串。成功返回时为空串。出错时，返回出错信息
 * @param {String} callback.result.data 附加结果
 * @support for callback.result.data iOS not support
 * @support for callback.result.data android 5.2

 *
 * @support iOS 4.6.1
 * @support android 4.6.1
 */

mqq.build('mqq.tenpay.openTenpayView', {
    iOS: function(options, callback) {
        var callbackName = callback ? mqq.callback(callback) : null;
        mqq.invokeClient('pay', 'openTenpayView', {
            'params': options,
            'callback': callbackName
        });
    },
    android: function(params, callback) {
        mqq.invokeClient('pay', 'openTenpayView', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.6.1',
        android: '4.6.1'
    }
});
;/**
 * @function tenpay.pay
 * @desc 唤起财付通支付界面
 *
 * @param {Object} param
 * @param {String} param.prepayId 调用财付通后台接口生成的订单号（必选字段,20160901名称由tokenId变更而来,tokenId参数名称仍可使用）
 * @param {String} param.pubAcc 公众帐号uin，用于在支付成功后关注该公众帐号。
 * @support for param.pubAcc iOS 4.7
 * @support for param.pubAcc android 4.7

 * @param {String} param.pubAccHint 公众帐号关注提示语，用于显示在支付成功页面。
 * @support for param.pubAccHint iOS 4.7
 * @support for param.pubAccHint android 4.7

 * @param {String} param.appInfo 标记业务及渠道，用来统计各业务KPI完成度
 * @note for param.appInfo 注意：字段由三部分组成：
 * @note for param.appInfo appid#XXXXXXXXX|bargainor_id#XXXXXXXX|channel#XXXXX
 * @note for param.appInfo 注：由于url字段包含"="，所以不在appInfo字段使用"="，而改用"#"代替
 * @note for param.appInfo 第一部分：应用唯一id：appid
 * @note for param.appInfo - appid请咨询SNG增值渠道部分配唯一的appid；
 * @note for param.appInfo 第二部分：商户号：bargainor_id
 * @note for param.appInfo 第三部分：渠道：channel，目前分配值：
 * @note for param.appInfo - wallet：钱包首页商城
 * @note for param.appInfo - account：应用生活服务帐号
 * @note for param.appInfo - dongtai：动态
 * @note for param.appInfo - qun：群
 * @note for param.appInfo - huodong：热门活动
 * @note for param.appInfo - aio：聊天窗口
 * @note for param.appInfo - banner：手Qbanner
 * @note for param.appInfo - gdt：广点通
 * @note for param.appInfo - shareurl：分享链接
 * @note for param.appInfo - qrcode：扫码
 * @note for param.appInfo - wallet_account：QQ钱包官号
 * @note for param.appInfo - personalstore：个性装扮
 * @note for param.appInfo - qbjx：钱包精选
 * @note for param.appInfo - other：其它
 * @note for param.appInfo （其它发现无对应渠道的情况，请咨询SNG增值渠道部分配新渠道标识）

 * @param {Function} callback 支付成功/失败的回调
 * @param {Object} callback.result
 * @param {Number} callback.resultCode 错误码
 * @options for callback.resultCode -1: 未知错误
 * @options for callback.resultCode 0: 发货成功
 * @options for callback.resultCode 1: 下订单失败
 * @options for callback.resultCode 2: 支付失败
 * @options for callback.resultCode 3: 发货失败
 * @options for callback.resultCode 4: 网络错误
 * @options for callback.resultCode 5: 登录失败或无效
 * @options for callback.resultCode 6: 用户取消
 * @options for callback.resultCode 7: 用户关闭IAP支付
 *
 * @param {String} callback.result.retmsg 表示调用结果信息字符串。成功返回时为空串。出错时，返回出错信息
 * @param {Object} callback.result.data 当resultCode=0时，有返回data对象
 * @param {string} callback.result.data.transaction_id 财付通交易单号
 * @param {string} callback.result.data.pay_time 交易时间
 * @param {string} callback.result.data.total_fee 订单总金额（单位为分）
 * @param {string} callback.result.data.callback_url 商户提供的回调url地址（HTML5方式调用适用，其它情形为空）
 * @param {string} callback.result.data.sp_data 返回给商户的信息，商户前端可解析校验订单支付结果。
 *
 * @example
 * mqq.tenpay.pay({
 *     prepayId: "xxxx", //20160901名称由tokenId变更而来,老的tokenId参数名称仍可使用
 *     pubAcc: "xxxx",
 *     pubAccHint: "xxxx"
 * });
 *
 * @support iOS 4.6.1
 * @support android 4.6.1
 * @note 支付成功的回调在 Android 4.6.2 之前的实现有 Bug，4.6.0之前从aio打开的webview会没有回调，4.6.1在生活优惠的webview会没有回调。需要页面兼容一下，给个提示框让用户点击，从后台查支付状态。最新版本已经修复。
 * @change v4.7.0: 增加 pubAcc 和 pubAccHint 参数
 */

(function() {

    var wrapCallback = function(callback) {
        return function(resultCode, data, raw) {

            // iOS端手Q5.3.1 开始，就直接返回json对象格式参数，无需在做解析
            if ( raw ) {
                try {
                    callback && callback(JSON.parse(raw));
                    return;
                } catch (e) {};
            }

            // 返回的 resultCode 有可能是字符串数字
            resultCode = Number(resultCode);

            var result = {
                resultCode: resultCode,
                retmsg: '',
                data: {}
            };
            if (resultCode === 0) {
                //保存原始attach信息
                var rawData = data;

                data = mqq.mapQuery(data);
                //此处与android返回一致
                data['sp_data'] = rawData;

                if (data.attach && data.attach.indexOf('{') === 0) {
                    data.attach = JSON.parse(data.attach);
                }
                if (data['time_end']) {
                    data['pay_time'] = data['time_end'];
                }
                result.data = data;
            } else if (resultCode === 1 || resultCode === -1) {
                result.retmsg = '用户主动放弃支付';
                result.resultCode = -1;
            } else {
                result.retmsg = data;
            }

            callback && callback(result);
        };
    };

    mqq.build('mqq.tenpay.pay', {
        iOS: function(params, callback) {

            params['order_no'] = params.tokenId || params.tokenID || params.prepayId;
            params['app_info'] = params['app_info'] || params.appInfo;
            //如果调用时有传入使用回调函数封装则封装回调，否则直接透传
            // params['wrapResult'] = params['wrapResult'] || false;

            if (mqq.compare('4.6.2') >= 0) {
                mqq.invokeSchema('mqqapi', 'wallet', 'pay', params, wrapCallback(callback));
            } else {
                mqq.invokeSchema('mqqapiwallet', 'wallet', 'pay', params, wrapCallback(callback));
            }

        },
        android: function(params, callback) {
            //不是token_id。20170925修复
            params['tokenId'] = params.tokenId || params.tokenID || params.prepayId;
            params['app_info'] = params['app_info'] || params.appInfo;
            //如果调用时有传入使用回调函数封装则封装回调，否则直接透传
            // params['wrapResult'] = params['wrapResult'] || false;

            if (mqq.compare('4.6.1') >= 0) {

                // 4.6.1 有新的接口
                mqq.invokeClient('pay', 'pay', JSON.stringify(params), callback);
            } else {

                mqq.invokeSchema('mqqapi', 'tenpay', 'pay', params, wrapCallback(callback));
            }
        },
        supportInvoke: true,
    support: {
            iOS: '4.6.1',
            android: '4.6.1'
        }
    });
})();
;/**
 * @function tenpay.rechargeGameCurrency
 * @desc 充值游戏币
 *
 * @param {Object} param
 * @param {String} param.offerId 必须设置。offerId可以在http://cpay.qq.com/jr申请
 * @param {String} param.userId 用户的id，QQ号码用于验证和当前登录用户是否匹配（必选字段）
 * @param {String} [param.zoneId] 游戏服务器大区id，游戏不分大区则默认zoneId =“1”
 * @param {String} [param.acctType] 账户类型，分为基础货币和安全货币，默认为基础货币
 * @options for param.acctType acctType = "common" （基础货币）
 * @options for param.acctType acctType = "security"（安全货币）
 * @param {String} [param.saveValue] 充值游戏币数量，可以不填
 * @param {String} [param.isCanChange] 购买数量是否可改，会员服务默认填写true
 * @param {String} [param.remark] sdk会透传给portal和二级boss，对应portal的payremark字段
 * @note for param.remark 如果remark字段传，流水会记录remark的内容
 * @note for param.remark 如果remark为空，流水记录pf的内容
 * @param {String} [param.aid] 标记业务来源：格式如vip.pingtai.vipsite.index
 * @param {Boolean} [param.numberVisible 是否显示购买数量，默认填写true
 * @param {String} [param.discountId] 基于该平台可以通过配置MP单进行营销活动开发，同开通相关的主要是，在支付时传入MP单号，计费平台部会在开通成功后根据该MP单号，赠送MP单对应的配置物品
 * @support for param.discountId iOS 5.2
 * @support for param.discountId Android 5.2
 * @param {String} [param.other] 预留接口
 * @support for param.other iOS 5.2
 * @support for param.other Android 5.2

 * @param {Function} callback
 * @param {Function} callback.result

 * @param {Number} callback.result.resultCode 回调到应用时，应用侧先检查resultCode，如果为 0 则可以继续检查是否支付成功和发货成功否则表明用户未支付或者支付出错。
 * @options for callback.result.resultCode -1: 支付流程失败
 * @options for callback.result.resultCode 0: 支付流程成功
 * @options for callback.result.resultCode 2: 用户取消

 * @param {Number} callback.result.realSaveNum 购买成功时购买的数量
 * @param {Number} callback.result.payChannel 支付渠道，只有支付成功时才返回相应的支付渠道
 * @options for callback.result.payChannel -1: 未知
 * @options for callback.result.payChannel 0: Q点渠道
 * @options for callback.result.payChannel 1: 财付通
 * @options for callback.result.payChannel 2: 银行卡支付
 * @options for callback.result.payChannel 3: 银行卡快捷支付
 * @options for callback.result.payChannel 4: Q卡渠道
 * @options for callback.result.payChannel 5: 手机充值卡渠道
 * @options for callback.result.payChannel 6: 话费渠道
 * @options for callback.result.payChannel 7: 元宝渠道
 * @options for callback.result.payChannel 8: 微信支付渠道

 * @param {Number} callback.result.payState 支付状态
 * @options for callback.result.payState -1: 支付状态未知
 * @options for callback.result.payState 0: 支付成功
 * @options for callback.result.payState 1: 用户取消
 * @options for callback.result.payState 2: 支付出错

 * @param {Number} callback.result.provideState 发货状态
 * @options for callback.result.provideState -1: 无法知道是否发货成功，如：财付通、手机充值卡渠道
 * @options for callback.result.provideState 0: 发货成功
 * @param {String} callback.result.resultMsg 返回信息
 * @param {String} callback.result.extendInfo 扩展信息
 * @param {String} callback.result.payReserve1 保留字1
 * @param {String} callback.result.payReserve2 保留字2
 * @param {String} callback.result.payReserve3 保留字3
 *
 * @support iOS not support
 * @support android 4.6.1
 * @note 由于存在一些支付渠道（如手机充值卡、财付通）不是实时到账，无法确定是否发货成功，只能知道支付是否成功。（只有个帐和Q卡渠道是实时到账）
 * @change v4.7: 增加 unit 参数
 */

mqq.build('mqq.tenpay.rechargeGameCurrency', {

    android: function(params, callback) {
        mqq.invokeClient('pay', 'rechargeGameCurrency', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        android: '4.6.1'
    }
});
;/**
 * @function tenpay.rechargeQb
 * @desc 充值Q币
 *
 * @param {Object} param
 * @param {String} param.offerId 必须设置。offerId可以在http://cpay.qq.com/jr申请
 * @param {String} param.userId 用户的id，QQ号码用于验证和当前登录用户是否匹配（必选字段）
 * @param {String} param.channel channel取值：“bank”（银行卡快捷支付），“wechat”（微信支付）,其他渠道暂时不支持指定渠道支付。
 * @note for param.channel 如果要取消指定渠道，则channel传递空串或者null即可。
 * @note for param.channel 如果游戏中调用该方法并支付后，要调用正常的支付流程，请将参数设置为空或者null。
 * @param {String} param.unit 显示的单位量词，比如传递“个”，“张”，默认为“月”
 * @param {String} param.saveValue 充值游戏币数量，可以不填
 * @param {String} param.aid 标记业务来源：格式如vip.pingtai.vipsite.index
 * @param {Boolean} param.numberVisible 是否显示购买数量，默认填写true
 * @param {String} param.discountId 基于该平台可以通过配置MP单进行营销活动开发，同开通相关的主要是，在支付时传入MP单号，计费平台部会在开通成功后根据该MP单号，赠送MP单对应的配置物品
 * @support for param.discountId iOS 5.2
 * @support for param.discountId Android 5.2
 * @param {String} param.provideUin 被赠送人号码。
 * @note for param.provideUin 如果自己充Q币，不传该参数
 * @support for param.provideUin iOS 5.2
 * @support for param.provideUin Android 5.2
 * @param {String} param.provideType provideType是发货类型，跟登录的userId有关系，如果userId 是QQ号码，如userId = “281348406”(QQ号)，则provideType的值是“uin”；如果userId 是openid的形式，例如userId  = “559B3E350A3AC6EB5CA98068AE5BA451”（openid），则provideType的值是“openid”。
 * @note for param.provideType 如果自己充Q币，不传该参数
 * @support for param.provideType iOS 5.2
 * @support for param.provideType Android 5.2
 * @param {String} param.other 预留接口
 * @support for param.other iOS 5.2
 * @support for param.other Android 5.2

 * @param {Function} callback
 * @param {Function} callback.result

 * @param {Number} callback.result.resultCode 回调到应用时，应用侧先检查resultCode，如果为 0 则可以继续检查是否支付成功和发货成功否则表明用户未支付或者支付出错。
 * @options for callback.result.resultCode -1: 支付流程失败
 * @options for callback.result.resultCode 0: 支付流程成功
 * @options for callback.result.resultCode 2: 用户取消

 * @param {Number} callback.result.realSaveNum 购买成功时购买的数量
 * @param {Number} callback.result.payChannel 支付渠道，只有支付成功时才返回相应的支付渠道
 * @options for callback.result.payChannel -1: 未知
 * @options for callback.result.payChannel 0: Q点渠道
 * @options for callback.result.payChannel 1: 财付通
 * @options for callback.result.payChannel 2: 银行卡支付
 * @options for callback.result.payChannel 3: 银行卡快捷支付
 * @options for callback.result.payChannel 4: Q卡渠道
 * @options for callback.result.payChannel 5: 手机充值卡渠道
 * @options for callback.result.payChannel 6: 话费渠道
 * @options for callback.result.payChannel 7: 元宝渠道
 * @options for callback.result.payChannel 8: 微信支付渠道

 * @param {Number} callback.result.payState 支付状态
 * @options for callback.result.payState -1: 支付状态未知
 * @options for callback.result.payState 0: 支付成功
 * @options for callback.result.payState 1: 用户取消
 * @options for callback.result.payState 2: 支付出错

 * @param {Number} callback.result.provideState 发货状态
 * @options for callback.result.provideState -1: 无法知道是否发货成功，如：财付通、手机充值卡渠道
 * @options for callback.result.provideState 0: 发货成功
 * @param {String} callback.result.resultMsg 返回信息
 * @param {String} callback.result.extendInfo 扩展信息
 * @param {String} callback.result.payReserve1 保留字1
 * @param {String} callback.result.payReserve2 保留字2
 * @param {String} callback.result.payReserve3 保留字3
 *
 * @support iOS 5.2
 * @support android 4.6.1
 * @note 由于存在一些支付渠道（如手机充值卡、财付通）不是实时到账，无法确定是否发货成功，只能知道支付是否成功。（只有个帐和Q卡渠道是实时到账）
 * @change v4.7: 增加 unit 参数
 */

mqq.build('mqq.tenpay.rechargeQb', {

	iOS: function(params, callback) {
        mqq.invokeClient('tenpay', 'rechargeQb', JSON.stringify(params), callback);
    },
    android: function(params, callback) {
        mqq.invokeClient('pay', 'rechargeQb', JSON.stringify(params), callback);
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '4.6.1'
    }
});
;/**
 * @function ui.addFriend
 * @desc 添加好友
 *
 * @param {Object} param
 *
 * @param {String} param.openId 账号的openId
 * @support for param.openId android 7.1.5
 * @support for param.openId iOS 7.1.5 
 

 * @param {String} param.appId 分享应用Id
 * @support for param.appId android 7.1.5 
 * @support for param.appId iOS 7.1.5

 * @param {String} param.nickName 好友的昵称
 * @support for param.nickName android 7.1.5
 * @support for param.nickName iOS 7.1.5

 * @param {String} param.msg 验证消息内容
 * @support for param.msg android 7.1.5
 * @support for param.msg iOS 7.1.5
 *

 * @param {Number} param.sourceId 后台分配的subId
 * @support for param.sourceId android 7.1.5
 * @support for param.sourceId iOS 7.1.5
 *

 * @param {String} param.callback 回调
 * @support for param.callback android 7.1.5
 *

 *
 * @example
 * //设置导航栏为黑色背景、红色文字：
 * mqq.ui.addFriend({openId:'xxxx', appId:'xxxx'nickName:'ssss', msg:'vvv',sourceId:'xxxx'});
 *
 * @support android 7.1.5
 * @support iOS 	7.1.5
 */;/**
 * @function ui.addShortcut
 * @desc 生成桌面快捷方式图标
 *
 * @param {Object} params
 * @param {String} params.action 点击桌面快捷方式后，是用什么动作响应操作，目前只支持`webView`打开方式。将来可能会支持打开`native`界面
 * @param {String} [params.title] 标题，缺省的话就取当前页面的title
 * @param {String} [params.icon] 快捷方式图标，可以缺省，使用手Q默认icon
 * @param {String} params.url 点击快捷方式跳转的目标url，不可缺省
 * @param {Function} [params.callback] 回调web端用到的关键字
 * @support for params.callback iOS not support
 * @support for params.callback android 5.8
 * @param {Object} params.callback.argus
 * @param {Object} params.callback.argus.result 设置结果
 * @options for params.callback.argus.result 0：创建桌面快捷方式成功
 * @options for params.callback.argus.result -1 url字段为空
 * @options for params.callback.argus.result -2：终端拿到的json格式解析出错
 * @options for params.callback.argus.result -3：icon字段下载到的数据为空，或者下载到的不是图片数据
 * @param {Object|String} params.callback.argus.resultData extras透传的数据
 * @param {String} params.callback.argus.message 错误提示
 * @param {Object|String} [params.extras] 需要透传给web端的数据，可缺省
 *
 * @example
 * mqq.ui.addShortcut({
 *     title: '兴趣部落',
 *     icon: 'http://km.oa.com/files/groups/icons/18675.jpg',
 *     url: 'http://xiaoqu.qq.com/mobile/index.html?_wv=1027&_bid=128&redid=0'
 * })
 *
 * @support iOS 4.5
 * @support android 5.8
 */

mqq.build('mqq.ui.addShortcut', {
    iOS: function(params) {

        mqq.invokeClient('nav', 'openLinkInSafari', {
            'url': 'http://open.mobile.qq.com/sdk/shortcut.ios.html?'+ mqq.toQuery(params)+'#from=mqq'
        });
    },
    android: function(params) {

        params.data = {
            "title" : params.title,
            "icon" : params.icon,
            "url" : params.url
        }
        params.callback = mqq.callback(params.callback);

        mqq.invokeClient('ui', 'addShortcut', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.8',
        android: '5.8'
    }
});
;/**
 * @namespace ui
 * @desc 界面相关接口
 */

/**
 * @function ui.closeWebViews
 * @desc 关闭所有相邻的 WebView（包括直接相邻的和间接相邻的）
 *
 * @param {Object} param
 *
 * @param {Number} param.mode 关闭模式，有如下几种模式：
 * @options for param.mode 0: 默认模式，关闭所有相邻 webview
 * @options for param.mode 1: 关闭在当前webview之上的所有相邻webview
 * @options for param.mode 2: 关闭在当前webview之下的所有相邻webview
 *
 * @param {Boolean} param.exclude 是否不关闭当前webview
 * @default for param.exclude false - 关闭当前webview
 * @note 当前webview指调用本接口的webview，不一定是当前可见的webview
 *
 * @support iOS 5.2
 * @support android 5.2
 */

mqq.build('mqq.ui.closeWebViews', {
    iOS: function(params) {
        mqq.invokeClient('ui', 'closeWebViews', params || {});
    },
    android: function(params) {
        mqq.invokeClient('ui', 'closeWebViews', params || {});
    },
    supportInvoke: true,
    support: {
        iOS: '5.2',
        android: '5.2'
    }
});
;/**
 * @function ui.disableLongPress
 * @desc 关闭长按功能（仅对图片长按生效，关闭页面长按请使用ui.disableWebviewLongPress），该接口需调用mqq.invoke进行调用，具体请参照例子
 *
 * @param {Object} params
 * @param {String} params.enable 关闭标识
 * @options for params.enable true 关闭
 * @options for params.enable false 开启
 *
 * @example
 * mqq.invoke('ui', 'disableLongPress', {
 *     enable: true,
 * })
 * 
 * @note 该接口仅针对图片长按，对Android端长按页面出现的菜单无效
 * @note 该能力同样可以通过`_wv=67108864`参数实现
 *
 * @support iOS 5.8
 * @support android 5.8
 */;/**
 * @function ui.disableWebviewLongPress
 * @desc 关闭WebView的长按功能，该接口需调用mqq.invoke进行调用，具体请参照例子
 *
 * @param {Object} params
 * @param {String} params.enable 关闭标识
 * @options for params.enable true 关闭
 * @options for params.enable false 开启
 *
 * @example
 * mqq.invoke('ui', 'disableWebviewLongPress', {
 *     enable: true,
 * })
 *
 * @support iOS 5.8
 * @support android 5.8
 */;/**
 * @function ui.groupOrganizationView
 * @desc 打开群组织结构列表界面
 *
 * @param {Object} params 参数
 * @param {String} params.appid
 * @param {String} [params.maxSelect] 为自定义选择个数上限，1是单选，0标示多选，且默认上限为50，可设置最大值为50
 * @param {Function} params.callback 回调
 * @param {Number} params.callback.ret 返回码
 * @options for params.callback.ret 0：正常
 * @options for params.callback.ret 1：非团队群
 * @options for params.callback.ret 2：非群环境
 * @options for params.callback.ret 3：参数错误
 * @options for params.callback.ret 4：内部错误
 * @options for params.callback.ret 5：用户取消
 * @param {String} params.callback.errMsg 错误信息
 * @param {Array} params.callback.openIDArr 
 * 
 * @example
 * mqq.invoke('ui', 'groupOrganizationView', {
 *    "appid":xxxx,
 *    "maxSelect":xxx,
 *    "callback": function () {
 *        // { ret:x, errMsg:"xxx", openIDArr:[xxx, xxx, xxx] }
 *    }
 * });
 * 
 * @note 注意：该接口直接使用`mqq.invoke`调用，不支持`mqq.ui.groupOrganizationView`
 *
 * @support iOS 6.3
 * @support Android 6.3
 */;/**
 * @function ui.invokeClientAction
 * @desc 执行终端本地操作，支持页面刷新、收藏、举报等操作。该接口需调用mqq.invoke进行调用，具体请参照例子
 *
 * @param {Object} params
 * @param {Number} params.action 操作类型
 * @options for params.action 0 页面刷新
 * @options for params.action 1 收藏
 * @options for params.action 2 举报
 *
 * @example
 * mqq.invoke('ui', 'invokeClientAction', {
 *     action: 0
 * })
 * 
 *
 * @support iOS 6.7.0
 * @support android 6.7.0
 */;mqq.build('mqq.ui.mobileDataDialog', {
	android: function (params) {
		var callback = params.callback;
		if (callback) {
			if (mqq.compare('7.1.5') < 0) {
				callback({ result: 0 });
			} else {
				mqq.invokeClient('ui', 'mobileDataDialog', { source: params.source, type: params.type, callback: mqq.callback(callback) })
			}
		}
	},
	iOS: function (params) {
		var callback = params.callback;
		if (callback) {
			if (mqq.compare('7.5.5') < 0) {
				callback({ result: 0 });
			} else {
				mqq.invokeClient('ui', 'mobileDataDialog', { source: params.source, type: params.type, callback: mqq.callback(callback) })
			}
		}
	},
	supportInvoke: true,
	support: {
		//走封装逻辑，不走mqq底层逻辑
		android: '4.2',
		iOS: '4.2'
	}
});


;/**
 * @function ui.openAIO
 * @desc 打开指定聊天窗口
 *
 * @param {Object} param
 *
 * @param {String} param.uin 对方的QQ号码
 * @param {String} param.chat_type 聊天类型
 * @options for param.chat_type c2c - 如果是好友，则进好友聊天界面，非好友，进陌生人聊天界面
 * @options for param.chat_type group - 群聊天
 * @options for param.chat_type discuss - 讨论组
 *
 * @example
 * mqq.ui.openAIO({
 *    uin: "100000",
 *    chat_type: "c2c"
 * });
 *
 * @support iOS 4.5
 * @support android 4.5
 *
 * @care 可打开指定（QQ号/QQ群）聊天窗口，存在钓鱼推广风险
 */


mqq.build('mqq.ui.openAIO', {
    iOS: function(params) {

        mqq.invokeSchema('mqqapi', 'im', 'chat', params);
    },
    android: function(params) {

        mqq.invokeSchema('mqqapi', 'im', 'chat', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.5'
    }
});
;/**
 * @function ui.openGroupCard
 * @desc 打开指定群成员名片
 *
 * @param {Object} param
 * @param {String} param.groupUin 群ID
 * @param {String} param.memberUin 成员qq号
 *
 * @example
 * mqq.ui.openGroupCard({
 *     groupUin: '12345'
 *     memberUin: '123444'
 * });
 *
 * @support iOS 5.8
 * @support android 5.8
 */


mqq.build('mqq.ui.openGroupCard', {
    iOS: function(params) {

        mqq.invokeClient('nav', 'openSpecialView', params);
    },
    android: function(params) {

        mqq.invokeClient('ui', 'openSpecialView', {"viewName":"troopMemberCard","param":params});
    },
    supportInvoke: true,
    support: {
        iOS: '5.8',
        android: '5.8'
    }
});
;/**
 * @function ui.openGroupFileView
 * @desc 打开指定群文件
 *
 * @param {Object} param
 * @param {String} param.groupUin 群ID
 *
 * @example
 * mqq.ui.openGroupFileView({groupUin: '12345'});
 *
 * @support iOS 5.4
 * @support android 5.4
 * @ignore 1
 */


mqq.build('mqq.ui.openGroupFileView', {
    iOS: function(params) {

        mqq.invokeClient('ui', 'openGroupFileView', params);
    },
    android: function(params) {

        mqq.invokeClient('ui', 'openSpecialView', {"viewName":"groupFile","param":params});
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @function ui.openGroupPhotoView
 * @desc 打开指定群相册
 *
 * @param {Object} param
 * @param {String} param.groupUin 群ID
 *
 * @example
 * mqq.ui.openGroupPhotoView({groupUin: '12345'});
 *
 * @support iOS 5.4
 * @support android 5.4
 * @ignore 1
 */


mqq.build('mqq.ui.openGroupPhotoView', {
    iOS: function(params) {

        mqq.invokeClient('ui', 'openGroupPhotoView', params);
    },
    android: function(params) {

        mqq.invokeClient('ui', 'openSpecialView', {"viewName":"groupPhoto","param":params});
    },
    supportInvoke: true,
    support: {
        iOS: '5.4',
        android: '5.4'
    }
});
;/**
 * @function ui.openUrl
 * @desc 打开指定url
 *
 * @param {Object} param
 *
 * @param {String} param.url
 * @param {Number} param.target
 * @options for param.target 0: 在当前webview打开
 * @options for param.target 1: 在新webview打开
 * @options for param.target 2: 在外部浏览器上打开（iOS为Safari,Android为系统默认浏览器）
 * @default for param.target 0: 在当前webview打开
 *
 * @param {Number} param.style WebView的样式（只对target=1有效），可选值如下：
 * @options for param.style 0: 顶部标题栏模式（无底部工具栏）
 * @options for param.style 1: 顶部标题栏无分享入口（无底部工具栏）
 * @options for param.style 2: 底部工具栏模式（顶部标题依然会存在）
 * @options for param.style 3: 底部工具栏模式且顶部无分享入口（顶部标题依然会存在）
 * @default for param.style 0: 顶部标题栏模式（无底部工具栏）
 *
 * @param {Number} param.animation  ( v4.7 ) webview展示动画，（该参数仅对Android有效）可选值如下：
 * @options for param.animation 0: 从右往左
 * @options for param.animation 1: 直接打开
 * @options for param.animation 2: 从下往上
 * @default for param.animation 0: 从右往左
 * @support for param.animation Android 4.7
 *
 * @example
 * //用一个带底部导航栏、无分享按钮的WebView来打开链接
 * mqq.ui.openUrl({
 *     url: "http://news.qq.com",
 *     target: 1,
 *     style: 3
 * });
 *
 * @support iOS 4.5
 * @support android 4.6
 *
 * @changelist v4.7: android 4.7 已经把从 AIO 打开的 WebView 改为非单例，也就是用 openUrl({target: 1}) 能真正打开新的 WebView 了
 */
(function () {

    var used = {};
    var interval = 500; // 暂定500ms

    // 调用频率限制
    function canUse (url) {
        var ts = used[url];
        var now = +new Date;
        
        if ( ts && now - ts < interval )

            return false
        else {
            
            used[url] = now;
            return true
        }
    }

    //支持适配当前页面使用的协议, 如http、https
    function adaptProtocol (url) {
        if (url && url.indexOf('//') === 0) {
            url = window.location.protocol + url;
        }
        return url;
    }

    mqq.build('mqq.ui.openUrl', {
        iOS: function(params) {

            if (!canUse(params.url)) return;

            if (!params) {
                params = {};
            }
            var url = adaptProtocol(params.url);

            if (params.target === 2) {
                mqq.invokeClient('nav', 'openLinkInSafari', {
                    url: url
                });

            } else if (params.target === 1) {
                params.styleCode = ({
                    1: 4,
                    2: 2,
                    3: 5
                })[params.style] || 1;
                mqq.invokeClient('nav', 'openLinkInNewWebView', {
                    url: url,
                    options: params
                });

            } else {
                window.open(url, '_self');
            }


        },
        android: function(params) {

            if (!canUse(params.url)) return;

            if (!params) {
                params = {};
            }
            var url = adaptProtocol(params.url);

            if (params.target === 2) {
                if (mqq.compare('4.6') >= 0) {
                    mqq.invokeClient('publicAccount', 'openInExternalBrowser', url);
                } else if (mqq.compare('4.5') >= 0) {
                    mqq.invokeClient('openUrlApi', 'openUrl', url);
                }

            } else if (params.target === 1) {
                if (!params.style) {
                    params.style = 0;
                }

                if (mqq.compare('4.7') >= 0) {
                    mqq.invokeClient('ui', 'openUrl', {
                        url: url,
                        options: params
                    });
                } else if (mqq.compare('4.6') >= 0) {
                    mqq.invokeClient('qbizApi', 'openLinkInNewWebView', url, params.style);
                } else if (mqq.compare('4.5') >= 0) {
                    mqq.invokeClient('publicAccount', 'openUrl', url);
                } else {
                    window.open(url, '_self');
                }

            } else {
                window.open(url, '_self');
            }
        },
        browser: function(params) { // 兼容普通浏览器的调用
            if (!params) {
                params = {};
            }
            var url = adaptProtocol(params.url);

            if (params.target === 2) {
                window.open(url, '_blank');
            } else {
                window.open(url, '_self');
            }
        },
        supportInvoke: true,
        support: {
            iOS: '4.5',
            android: '4.6',
            browser: '0'
        }
    });

})();;/**
 * @function ui.openView
 * @desc iOS - 打开指定名字的viewController，Android - 打开指定className的Activity
 *
 * @param {Object} param
 *
 * @param {String} param.name iOS的view 名字如下:
 * @options for param.name "Coupon": 优惠券首页
 * @options for param.name "About": 手机QQ关于界面
 *
 * @param {Object} param.options 传递给客户端的启动参数，值为 key-value 形式
 * @support for param.options iOS 5.0
 * @support for param.options android 5.0
 *
 * @param {Function} param.onclose 当打开的ViewController(iOS)/Activity(Android)关闭后，客户端会执行这个回调，并可带上数据传回给原webview（即下面回调函数里的data）。
 * @support for param.onclose iOS 5.0
 * @support for param.onclose android 5.0
 * @param {Object} param.onclose.data
 *
 * @example
 * mqq.ui.openView({name: "About"});// iOS
 * mqq.ui.openView({name: "com.tencent.mobileqq.activity.AboutActivity"});// android});
 *
 * mqq.ui.openView({
 *     name: "ViewName",
 *     options: {"a": "b", "c": 1},
 *     onclose: function(data){ console.log(data) }
 * });
 *
 * @support iOS 4.5
 * @support android 4.6
 *
 * @care 可调用手机QQ未导出Activity组件
 */

;
(function() {

    var IOS_VIEW_MAP = {

    };

    var AND_VIEW_MAP = {
        'Abount': 'com.tencent.mobileqq.activity.AboutActivity',

        'GroupTribePublish': 'com.tencent.mobileqq.troop.activity.TroopBarPublishActivity',
        'GroupTribeReply': 'com.tencent.mobileqq.troop.activity.TroopBarReplyActivity',
        'GroupTribeComment': 'com.tencent.mobileqq.troop.activity.TroopBarCommentActivity'
    };


    mqq.build('mqq.ui.openView', {
        iOS: function(params) {

            params.name = IOS_VIEW_MAP[params.name] || params.name;
            if (typeof params.onclose === 'function') {
                params.onclose = mqq.callback(params.onclose);
            }
            mqq.invokeClient('nav', 'openViewController', params);
        },
        android: function(params) {

            params.name = AND_VIEW_MAP[params.name] || params.name;
            if (typeof params.onclose === 'function') {
                params.onclose = mqq.callback(params.onclose);
            }
            if (mqq.compare('5.0') > -1) {
                mqq.invokeClient('ui', 'openView', params);
            } else {
                mqq.invokeClient('publicAccount', 'open', params.name);
            }
        },
        supportInvoke: true,
    support: {
            iOS: '4.5',
            android: '4.6'
        }
    });

})();
;/**
 * @function ui.pageVisibility
 * @desc 查询页面的可见性。当当前可见view/activity不是本页面，或应用退到后台时，此接口返回false，否则返回true。
 *
 * @param {Function} callback
 * @param {Boolean} callback.result 页面可见返回 true，不可见返回 false
 *
 * @example
 * mqq.ui.pageVisibility(function(r){
 *     console.log("visible ?", r);
 * });
 * ...
 * document.addEventListener("qbrowserVisibilityChange", function(e){
 *     console.log(e.hidden);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 * @note 另外当页面可见性发生改变时，document会抛出qbrowserVisibilityChange事件。
 */

mqq.build('mqq.ui.pageVisibility', {
    iOS: function(callback) {
        if (mqq.__isWKWebView){
            mqq.invokeClient('ui', 'pageVisibility', {callback: mqq.callback(callback)});
        }else{
            mqq.invokeClient('ui', 'pageVisibility', callback);
        }
    },
    android: function(callback) {
        mqq.invokeClient('ui', 'pageVisibility', callback);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.popBack
 * @desc 关闭当前webview
 *
 * @example
 * mqq.ui.popBack();
 *
 * @support iOS 4.5
 * @support android 4.6
 */

mqq.build('mqq.ui.popBack', {
    iOS: function() {
        mqq.invokeClient('nav', 'popBack');
    },
    android: function() {
        mqq.invokeClient('publicAccount', 'close');
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});
;/**
 * @function ui.queryAdapterState
 * @desc 查询当前适配层状态
 *
 * 异常:
 * {"code":1,"msg":{"device not iPhoneX"}}
 *
 * 结果:
 * isTopAdapter    类型Number 0:顶部无适配 1:有
 * isBottomAdapter 类型Number 0:底部无适配 1:有
 * topAdapterColor 类型字符串     例: 颜色0xffffff
 * bottomAdapterColor 类型字符串  例: 颜色0xffffff
 * 例 {"code":0,"data":{"isTopAdapter":1,"isBottomAdapter":1,"topAdapterColor":"0xffffff","bottomAdapterColor":"0xffffff"}}

 * @example
 * mqq.ui.queryAdapterState();
 *
 * @support iOS 7.2.8
 */

mqq.build('mqq.ui.queryAdapterState', {
    iOS: function() {
        mqq.invokeClient('ui', 'queryAdapterState');
    },
    supportInvoke: true,
    support: {
        iOS: '7.2.8',
    }
});;/**
 * @function ui.refreshTitle
 * @desc 刷新客户端显示的网页标题。在iOS中，网页标题动态改变后，显示WebView的导航栏标题不会改变，请调用refreshTitle来手动刷新。Android不需要。
 *
 * @example
 * document.title="新标题";
 * mqq.ui.refreshTitle();
 *
 * @support iOS 4.6
 * @support android not support
 */

mqq.build('mqq.ui.refreshTitle', {
    iOS: function() {
        mqq.invokeClient('nav', 'refreshTitle');
    },
    supportInvoke: true,
    support: {
        iOS: '4.6'
    }
});
;/**
 * @function ui.returnToAIO
 * @desc 返回到打开该webview的AIO，例如使用 openUrl 打开了多个 WebView 之后，调用 returnToAIO 将立刻返回到打开 WebView 之前的 AIO 窗口。而调用 popBack 只会关闭当前 WebView。
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.ui.returnToAIO', {
    iOS: function() {
        mqq.invokeClient('nav', 'returnToAIO');
    },
    android: function() {
        mqq.invokeClient('qbizApi', 'returnToAIO');
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function ui.scanQRcode
 * @desc 唤起扫一扫来扫描二维码
 *
 * @param {String} name 扫描结果如果要放到url的#参数上，则指定一个参数名
 * @param {Function} callback扫描结果回调
 * @param {String} callback.result 扫描的结果字符串
 *
 * @example
 * mqq.ui.scanQRcode({}, function(result){
 *     console.log(retCode, decodeURIComponent(result));
 * })
 *
 * @support iOS 4.7
 * @support android 4.7
 */

mqq.build('mqq.ui.scanQRcode', {
    iOS: function(params, callback) {
        params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('ui', 'scanQRcode', params);
    },
    android: function(params, callback) {
        params = params || {};
        if (callback) {
            params.callback = mqq.callback(callback);
        }
        mqq.invokeClient('ui', 'scanQRcode', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.selectContact
 * @desc 选择联系人
 *
 * @param {Object} param
 *
 * @param {Number} param.appid 业务对应id
 * @param {Number} param.acceptType 1好友, 4群, 8讨论组; 同时接收多种类型时, 把值相加, 默认13
 * @param {Function} param.callback 执行回调函数
 *
 * @param {Object} param.callback.params
 * @param {Number} param.callback.params.ret 返回码，0:正常，1:登录态不一致
 * @options for param.callback.params.ret 0 - 正常
 * @options for param.callback.params.ret 1 - 登录态不一致
 * @options for param.callback.params.ret 2 - 服务器返回错误(openid转换失败)
 * @options for param.callback.params.ret 3 - 用户取消
 * @options for param.callback.params.ret 4 - 客户端异常
 * @param {String} param.callback.params.errMsg 错误信息，比如“无效appid”
 * @param {Array} param.callback.params.contacts 选择的好友数据列表，内容如下： - [{type:1, openID:xxx}, {type:2, openID:xxx}, … ]
 * 
 * @example
 * mqq.ui.selectContact({
 *   appid: 100363349, //必填
 *   acceptType: 3, // 1好友, 4群, 8讨论组; 同时接收多种类型时, 把值相加, 默认13
 *   callback: function(obj) {
 *       console.log(JSON.stringify(obj));
 *   }
 * });
 *
 * @support iOS 5.3
 * @support android 5.3
 *
 * @important `maxSelect` 参数目前无法被支持到，暂时去除该参数
 */


mqq.build('mqq.ui.selectContact', {
    iOS: function(params) {
        var callbackName = mqq.callback(params.callback);
        params.callback = callbackName;
        mqq.invokeClient('ui', 'selectContact', params);
    },
    android: function(params) {
        var callbackName = mqq.callback(params.callback);
        params.callback = callbackName;
        mqq.invokeClient('ui', 'selectContact', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.3',
        android: '5.3'
    }
});
;/**
 * @function ui.setActionButton
 * @desc 配置webview右上角按钮的标题、点击回调等
 *
 * @param {Object} param
 *
 * @param {String} param.title 设置右上角的按钮的文字
 * @param {Boolean} param.hidden 是否隐藏右上角按钮
 * @support for param.hidden iOS 4.7
 * @support for param.hidden android 4.7
 *
 * @param {Number} param.iconID 图标的本地资源ID（只支持内置的资源）
 * @options for param.iconID 1: 编辑图标
 * @options for param.iconID 2: 删除图标
 * @options for param.iconID 3: 浏览器默认图标
 * @options for param.iconID 4: 分享图标
 * @options for param.iconID 5: 上传图标（有动画效果）
 * @options for param.iconID 7: 感叹号图标
 * @support for param.iconID iOS 4.7
 * @support for param.iconID android 4.7

 * @param {Number} param.cornerID 右上角图标的角标资源ID（只支持内置的资源）
 * @options for param.cornerID 0: 不显示
 * @options for param.cornerID 6: 感叹号图标
 * @support for param.cornerID iOS 5.3
 * @support for param.cornerID android 5.3
 *
 * @param {Function} callback 点击按钮后的回调
 *
 * @support iOS 4.6
 * @support android 4.6
 * @note 如果调用两次 setActionButton，第一次传了 callback 参数，而第二次没有传，在 android 和 iOS 的表现不一致：iOS 中右上角按钮将还原为默认行为，android 则是继续使用上一次传的 callback（v5.1 修复该问题）
 * @important 该接口已停止维护，可使用ui.setTitleButtons代替
 */

mqq.build('mqq.ui.setActionButton', {
    iOS: function(params, callback) {
        if (typeof params !== 'object') {
            params = {
                title: params
            };
        }

        var callbackName = mqq.callback(callback);
        params.callback = callbackName;
        mqq.invokeClient('nav', 'setActionButton', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);

        if (params.hidden) {
            params.title = '';
        }

        if (mqq.compare('4.7') >= 0) {
            params.callback = callbackName;
            mqq.invokeClient('ui', 'setActionButton', params);
        } else {
            mqq.invokeClient('publicAccount', 'setRightButton', params.title, '', callbackName || null);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function ui.setDoubleRightButton
 * @desc 配置webview右上角双按钮的图标、点击回调等
 *
 * @param {Object} param
 *
 * @param {String} param.iconID1 右上角第一个图标的本地资源ID（只支持内置的资源）
 * @options for param.iconID1 1: 编辑图标
 * @options for param.iconID1 2: 删除图标
 * @options for param.iconID1 3: 三个点图标
 * @options for param.iconID1 4: 分享图标
 * @options for param.iconID1 5: 上传图标（有动画效果）
 * @options for param.iconID1 7: 添加图标
 * @options for param.iconID1 8: 联系人图标1
 * @options for param.iconID1 9: 搜索图标1
 * @options for param.iconID1 10: 搜索图标2
 * @options for param.iconID1 11: 联系人图标2
 * @support for param.iconID1 iOS 4.7
 * @support for param.iconID1 android 6.6.5
 * 
 * @param {String} param._sharedCallbackID1 点击右上角第一个按钮的回调
 * @param {String} param.voiceStr1 右上角一个按钮的无障碍化语音提示
 *
 * @param {String} param.cornerID2 右上角第二个图标的角标资源ID（只支持内置的资源）
 * @options for param.iconID2 1: 编辑图标
 * @options for param.iconID2 2: 删除图标
 * @options for param.iconID2 3: 三个点图标
 * @options for param.iconID2 4: 分享图标
 * @options for param.iconID2 5: 上传图标（有动画效果）
 * @options for param.iconID2 7: 添加图标
 * @options for param.iconID2 8: 联系人图标1
 * @options for param.iconID2 9: 搜索图标1
 * @options for param.iconID2 10: 搜索图标2
 * @options for param.iconID2 11: 联系人图标2
 * @support for param.iconID2 iOS 5.3
 * @support for param.iconID2 android 6.6.5
 *
 * @param {String} param._sharedCallbackID2 点击右上角第二个按钮的回调
 * @param {String} param.voiceStr2 右上角二个按钮的无障碍化语音提示
 *
 * @support iOS 4.6
 * @support android 6.6.5
 */
;/**
 * @function ui.setLoading
 * @desc 配置菊花是否可见和样式。visible参数用于控制菊花是(true)否(false)可见，不传visible参数则不改变菊花的可见性
 *
 * @param {Object} param
 *
 * @param {Boolean} param.visible 控制菊花可见度
 * @param {Array|Number} param.color r, g, b 控制菊花颜色
 *
 * @example
 * mqq.ui.setLoading({visible: false});
 *
 * @support iOS 4.6 - 5.0
 * @support android 4.6
 *
 * @important 该接口在iOS QQ5.0之后已经废除，原因：ios UI规范在ios8.0使用顶部加载进度条
 */

mqq.build('mqq.ui.setLoading', {
    iOS: function(params) {

        if (params) {
            //文档上要求如果visible没有值，不去改变菊花。
            if (params.visible === true) {
                mqq.invokeClient('nav', 'showLoading');
            } else if (params.visible === false) {
                mqq.invokeClient('nav', 'hideLoading');
            }

            if (params.color) {
                mqq.invokeClient('nav', 'setLoadingColor', {
                    'r': params.color[0],
                    'g': params.color[1],
                    'b': params.color[2]
                });
            }
        }
    },
    android: function(params) {
        if ('visible' in params) {
            if (params.visible) {
                mqq.invokeClient('publicAccount', 'showLoading');
            } else {
                mqq.invokeClient('publicAccount', 'hideLoading');
            }
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function ui.setOnCloseHandler
 * @desc 设置webview被关闭前的回调, 设置回调后将会替换原来的行为
 *
 * @param {Function} callback
 *
 * @support iOS 4.7
 * @support android 4.7
 */

mqq.build('mqq.ui.setOnCloseHandler', {
    iOS: function(callback) {
        mqq.invokeClient('ui', 'setOnCloseHandler', {
            'callback': mqq.callback(callback)
        });
    },
    android: function(callback) {
        mqq.invokeClient('ui', 'setOnCloseHandler', {
            'callback': mqq.callback(callback)
        });
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.setOnShareHandler
 * @desc 设置web页面分享的监听事件。用户点击右上角的弹出菜单后，点击了分享时会通知页面，此时需要调用 shareMessage 主动发起分享（系统默认的分享行为不再执行）
 *
 * @param {Function} callback
 * @param {Number} callback.type 用户点击的分享类型
 * @options for callback.type 0：QQ好友
 * @options for callback.type 1：QQ空间
 * @options for callback.type 2：微信好友
 * @options for callback.type 3：微信朋友圈
 *
 * @support iOS 4.7.2
 * @support android 4.7.2
 * @note android 的实现跟 iOS 不太一致，android 上如果设置了点击分享的回调，10s内没有调用 shareMessage 的话，将会继续执行用户选择的分享流程，5.0修复这个问题
 */

mqq.build('mqq.ui.setOnShareHandler', {
    iOS: function(callback){
        mqq.invokeClient('nav', 'addWebShareListener', {'callback': mqq.callback(callback)});
    },
    android: function(callback){
        mqq.invokeClient('ui', 'setOnShareHandler', {'callback': mqq.callback(callback)});
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '4.7.2'
    }
});
;/**
 * @function ui.setPullDown
 * @desc 启动下拉刷新
 *
 * @param {Object} param
 * @param {Boolean} param.enable 启动标识, true 启动，false 不启动
 * @param {Boolean} param.success 业务方操作成功后，可以设置该参数，收起刷新界面
 * @param {Boolean} param.text 操作成功后提示文案
 *
 * @example
 * // 初始化启动下拉刷新的功能
 * mqq.ui.setPullDown({ enable: true });
 * // 监听`qbrowserPullDown`事件，当用户触发之后，即可开始处理业务方的逻辑
 * mqq.addEventListener("qbrowserPullDown", function () {
 *     // ... Your Code ...
 *     mqq.ui.setPullDown({ success: true , text: "刷新成功" })
 * });
 *
 * @support iOS 5.3
 * @support android 5.3
 * @note 下拉刷新的交互逻辑：该接口需要配合`qbrowserPullDown`事件使用，开启下拉刷新功能之后，当用户触发下拉动作时候，webview会抛出`qbrowserPullDown`事件，开发者需要监听该事件来实现自身业务逻辑，最后业务逻辑操作完成后，开发者需调用一次`mqq.ui.setPullDown({ success: true , text: "刷新成功" });`来收起下拉的界面。
 * @important Android端在该接口使用上存在较严重问题，当开启下拉刷新之后，页面无法再监听window的滚动事件；另外一些复杂交互建议不使用（譬如局部滚动，下拉等操作模拟），下一版本会对该接口进行完善
 */


mqq.build('mqq.ui.setPullDown', {
    iOS: function(params) {

        mqq.invokeClient('ui', 'setPullDown', params);
    },
    android: function(params) {

        mqq.invokeClient('ui', 'setPullDown', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.3',
        android: '5.3'
    }
});
;/**
 * @function ui.setRightDragToGoBackParams
 * @desc 设置向右划后退触发的区域
 *
 * @param {Object} param
 * @param {Boolean} param.enable 启动标识, true 启动，false 不启动
 * @param {String} param.width 右滑相应宽度， width 和 rect 参数 只设置一个即可，同时存在，rect优先。
 * @param {Object} param.rect 区域矩阵，例如：{x:0,y:0,width:60,height:500}
 *
 * @example
 * mqq.ui.setRightDragToGoBackParams({
 *     enable: true,
 *     width: 60
 * });
 * mqq.ui.setRightDragToGoBackParams({
 *     enable: true,
 *     rect: {x:0,y:0,width:60,height:500}
 * });
 *
 * @important 如果_wv参数禁止右划效果，那调用该接口将无法生效
 *
 * @support iOS 5.3
 * @support android not support
 */

mqq.build('mqq.ui.setRightDragToGoBackParams', {
    iOS: function(params) {

        mqq.invokeClient('ui', 'setRightDragToGoBackParams', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.3'
    }
});
;/**
 * @function ui.setTitleButtons
 * @desc 配置webview顶部按钮的标题、点击回调等
 *
 * @param {Object} param 参数不能不传，否则会报js错误
 *
 * @param {Object} param.left 左按钮
 * @param {String} param.left.title 文案
 * @support for param.left.title iOS 4.7.2
 * @support for param.left.title android 5.3
 *
 * @param {String} param.left.callback 回调
 * @support for param.left.callback iOS 4.7.2
 * @support for param.left.callback android 4.7
 *
 * @param {Object} param.right 右按钮
 * @param {String}  param.right.title 文案
 * @support for param.right.title iOS 4.6
 * @support for param.right.title android 4.6
 *
 * @param {Boolean} param.right.hidden 是否隐藏右上角按钮
 * @support for param.right.hidden iOS 4.7
 * @support for param.right.hidden android 4.7
 *
 * @param {Number} param.right.iconID 图标的本地资源ID（只支持内置的资源）
 * @options for param.right.iconID 1: 编辑图标
 * @options for param.right.iconID 2: 删除图标
 * @options for param.right.iconID 3: 浏览器默认图标
 * @options for param.right.iconID 4: 分享图标
 * @options for param.right.iconID 5: 上传图标（有动画效果）
 * @options for param.right.iconID 7: 感叹号图标*
 * @support for param.right.iconID iOS 4.7
 * @support for param.right.iconID android 4.7
 *
 * @param {String} param.right.callback 回调
 *
 *
 * @example
 * mqq.ui.setTitleButtons({
 *    left : {
 *        title : "返回",
 *        callback : function () {
 *            alert("点击左按钮")
 *        }
 *    },
 *    right : {
 *        title : "我的...",
 *        callback : function () {
 *            alert("点击右按钮")
 *        }
 *    }
 * })
 *
 * @support iOS 4.6
 * @support android 4.6
 */

mqq.build('mqq.ui.setTitleButtons', {
    iOS: function(params) {

        var left = params.left,
            right = params.right;

        if ( left )  left.callback  = mqq.callback(left.callback);
        if ( right ) right.callback = mqq.callback(right.callback);

        if (mqq.compare('5.3') >= 0) {
            mqq.invokeClient('ui', 'setTitleButtons', params);

        // 5.3之前需要使用`setLeftBtnTitle`、`setOnCloseHandler`跟`setActionButton`整合
        } else {
            if ( left ) {
                if ( left.title ) mqq.invokeClient('ui', 'setLeftBtnTitle', {title : left.title});
                if ( left.callback ) mqq.invokeClient('ui', 'setOnCloseHandler', left);
            }
            if ( right ) {
                /*if (typeof hasRight !== 'object') {
                    hasRight = {
                        title: hasRight
                    };
                }*/
                mqq.invokeClient('nav', 'setActionButton', right);
            }
        }
    },
    android: function(params) {

        var left = params.left,
            right = params.right;

        if ( left )  left.callback  = mqq.callback(left.callback);
        if ( right ) right.callback = mqq.callback(right.callback);

        if (mqq.compare('5.3') >= 0) {
            mqq.invokeClient('ui', 'setTitleButtons', params);

        // 5.3之前需要使用`setOnCloseHandler`跟`setActionButton`整合
        } else {
            if ( left ) {
                if ( left.callback ) mqq.invokeClient('ui', 'setOnCloseHandler', left);
                /*left.type = "left";
                left.wording = left.title;

                mqq.invokeClient('ui', 'setTitleButton', left);*/
            }
            if ( right ) {

                if (right.hidden) {
                    right.title = '';
                }

                if (mqq.compare('4.7') >= 0) {
                    mqq.invokeClient('ui', 'setActionButton', right);
                } else {
                    mqq.invokeClient('publicAccount', 'setRightButton', right.title, '', right.callback);
                }
            }
        }
    },
    supportInvoke: true,
    support: {
        iOS: '5.0',
        android: '4.6'
    }
});
;/**
 * @function ui.setTransparentTitleBar
 * @desc 配置webview透明标题栏,iOS:7.1.5版本开始和安卓对齐，调用此接口会让WebView从最顶部0像素开始布局
 *
 * @param {Object} param
 *
 * @param {String} param.bgclr 标题栏背景色，例如：'#FF0000'
 * @support for param.bgclr android 6.2.1

 * @param {String} param.txtclr 标题栏左右两边的文案颜色，例如：'#FF0000'
 * @support for param.txtclr android 6.2.1

 * @param {String} param.titleclr 标题栏中间的标题颜色，例如：'#FF0000'
 * @support for param.titleclr android 6.2.1

 * @param {Boolean} param.anim 设置是否允许动画，默认为false
 * @support for param.anim android 6.2.1
 *
 * @param {Number} param.dur 动画播放时间，单位ms
 * @support for param.dur android 6.2.1
 *
 * @param {Number} param.alpha 标题栏透明度，例如 0
 * @support for param.alpha android 6.2.1
 *
 * @example
 * //设置导航栏为黑色背景、红色文字：
 * mqq.ui.setTransparentTitleBar({bgclr:'#000000', titleclr:'#FF0000'});
 *
 * @support android 6.2.1
 */
;/**
 * @function ui.setWebViewBehavior
 * @desc 配置webview的行为
 *
 * @param {Object} param
 *
 * @param {Number} param.swipeBack 是(1)否(0)支持右划关闭手势
 * @support for param.swipeBack iOS 4.7.2
 * @support for param.swipeBack android not support
 *
 * @param {Number} param.actionButton 是(1)否(0)显示右上角按钮
 * @support for param.actionButton iOS 4.7.2
 * @support for param.actionButton android 5.1
 *
 * @param {Number} param.navBgColor 背景颜色，例如：0xFF0000
 * @support for param.navBgColor iOS 5.0
 * @support for param.navBgColor android 5.1

 * @param {Number} param.navTextColor 文字颜色，例如：0xFF0000
 * @support for param.navTextColor iOS 5.0
 * @support for param.navTextColor android 5.1 

 * @param {Number} param.navBottomLine 是(1)否(0)显示导航栏分割线
 * @support for param.navBottomLine iOS 7.0.0
 * @support for param.navBottomLine android not support
 
 * @param {Number} param.statusBarColor 状态栏背景颜色，例如：0xFF0000
 * @support for param.statusBarColor iOS 6.6.0
 * @support for param.statusBarColor android 6.6.0

 * @param {Number} param.bottomBar 控制底部导航条，默认false
 * @support for param.bottomBar iOS 5.7
 * @support for param.bottomBar android 5.7
 
 * @param {Number} param.navIconUseDefault 是否使用默认主题icon：1 - 使用默认主题icon，其他值 - 不使用默认主题icon，默认不使用
 * @support for param.navIconUseDefault iOS 5.7
 * @support for param.navIconUseDefault android 5.7

 * @param {Boolean} param.keyboardDisplayRequiresUserAction 设置为false允许js不经用户触发来弹起键盘
 * @support for param.keyboardDisplayRequiresUserAction iOS 5.1
 * @support for param.keyboardDisplayRequiresUserAction android not support
 *
 * @param {Boolean} param.progressBar 是否显示进度条，默认为true
 * @support for param.progressBar iOS 6.5.8
 * @support for param.progressBar android 6.5.8
 *
 * @param {String} param.titleText 标题文字，透明标题栏默认情况下可以用这个参数来设置标题展示。
 * @support for param.titleText iOS 6.5.8
 * @support for param.titleText android 6.5.8
 
 * @param {Boolean} param.titleBarHide 隐藏和展示标题栏，true：隐藏，false：展示
 * @support for param.titleBarHide iOS 6.5.8
 * @support for param.titleBarHide android 6.5.8
 
 * @param {Boolean} param.titleBarHideDuration 隐藏和展示标题栏的动画时间，单位：ms
 * @support for param.titleBarHideDuration iOS 6.5.8
 * @support for param.titleBarHideDuration android 6.5.8
 
 * @param {Number} param.orientation 设置横竖屏
 * @options for param.orientation 0: 竖屏
 * @options for param.orientation 1: 横屏
 * @support for param.orientation iOS 6.9.0
 * @support for param.orientation android 6.9.0

 * @param {String} param.xtopAdapterColor    iPhoneX适配顶部颜色，例:0xff33ff
 * @support for param.xtopAdapterColor       iOS 7.2.8
 
 * @param {String} param.xbottomAdapterColor iPhoneX适配底部颜色，例:0xff33ff
 * @support for param.xbottomAdapterColor    iOS 7.2.8
  
 * @param {String} param.xtopAdapterSetup   iPhoneX顶部适配层，例: 0:不需要 1:需要
 * @support for param.xtopAdapterSetup       iOS 7.2.8

 * @param {String} param.xbottomAdapterSetup  iPhoneX底部适配层，例: 0:不需要 1:需要
 * @support for param.xbottomAdapterSetup      iOS 7.2.8

 * @param {Number} param.webPageBackgroundColor  WebView背景颜色,需要webPageBackgroundColorOpen设置为true才有效
 * @support for param.webPageBackgroundColor     iOS 6.6.9

 * @param {Number} param.webPageBackgroundAlpha  WebView背景颜色透明度，需要webPageBackgroundColor有颜色才有效
 * @support for param.webPageBackgroundAlpha     iOS 6.6.9

 * @param {Number} param.webPageBackgroundColorOpen  WebView背景颜色是否可设置
 * @support for param.webPageBackgroundColorOpen     iOS 6.6.9

 * @example
 * //关闭右滑
 * mqq.ui.setWebViewBehavior({
 *     swipeBack:0
 * })
 *
 * //设置导航栏为黑色背景、红色文字：
 * mqq.ui.setWebViewBehavior({navBgColor:0x000000, navTextColor:0xFF0000});
 * //只修改背景颜色为灰色，文字颜色不变：
 * mqq.ui.setWebViewBahavior({navBgColor:0x666666});
 * //只修改文字颜色为黑色，背景颜色不变：
 * mqq.ui.setWebViewBahavior({navTextColor:0});
 * //恢复默认样式：
 * mqq.ui.setWebViewBehavior({navBgColor:-1, navTextColor:-1});
 * //隐藏底部导航条：
 * mqq.ui.setWebViewBehavior({bottomBar:false});
 *
 * @support iOS 4.7.2
 * @support android 5.1
 */

mqq.build('mqq.ui.setWebViewBehavior', {
    iOS: function(params) {
        mqq.invokeClient("ui", "setWebViewBehavior", params);
    },
    android: function(params) {
        mqq.invokeClient("ui", "setWebViewBehavior", params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '5.1'
    }
});
;/**
 * @function ui.shareArkMessage
 * @desc 调用客户端的分享接口，分享Ark消息给好友/群/讨论组，可以调用后弹出联系人选择列表，也可以指定uin直接发送给指定好友/群
 *
 * @param {Object} param
 *
 * @param {String} param.appName ArkApp的名称
 * @param {String} param.appView 要展示的ArkApp视图
 * @param {String} param.metaData 展示Ark消息需要的元数据。该参数是一段json字符串
 * @param {String} [param.appMinVersion] ArkApp支持的最小版本
 * @param {String} [param.appConfig] Ark消息的配置信息。该参数是一段json字符串，比如{'forward': 1, 'autosize': 1, 'type': 'card'}
 * @options for param.appConfig 'forward': 是否允许转发
 * @options for param.appConfig 'autosize': 自动调整大小
 * @options for param.appConfig 'type': 页卡模式和非页卡模式
 * @param {String} [param.appDesc] Ark消息的描述
 * @param {String} [param.promptText] Ark消息的提示文案，表现为消息列表中每条消息的外显文案
 * @param {String} [param.compatibleText] Ark消息的兼容文案
 * @param {String} [param.back] 发送消息之后是否返回到web页面，默认false，直接到AIO
 * @param {String} [param.toUin] 分享给指定的好友或群，如果存在这个参数，则不拉起好友选择界面 (针对分享给好友)
 * @param {String} [param.toNickName] 分享给指定好友昵称或群名称
 * @param {Number} [param.uinType] 分享给指定的好友或群的uin类型: 0：好友；1：群 (针对分享给好友)
 *
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {Number} callback.result.retCode 返回码
 * @options for callback.result.retCode 0：用户点击发送，完成整个分享流程
 * @options for callback.result.retCode 1：缺少必填参数
 * @options for callback.result.retCode 2：appName不在白名单内
 * @options for callback.result.retCode 3：参数格式错误(json格式错误)
 * @options for callback.result.retCode 4：用户点击取消，中断分享流程
 *
 * @important 请联系felixxfwang，将要分享的ArkApp的appName添加到白名单，否则分享无效
 *
 * @support iOS 7.2.5
 * @support android 7.2.5
 */

mqq.build('mqq.ui.shareArkMessage', {
	iOS: function(params, callback) {
			mqq.invokeClient('QQApi', 'shareArkMessage', params, mqq.callback(callback));
	},
	android: function(params, callback) {
			mqq.invokeClient('QQApi', 'shareArkMessage', params, mqq.callback(callback));
	},
	supportInvoke: true,
	support: {
			iOS: '7.2.5',
			android: '7.2.5'
	}
});
;/**
 * @function ui.shareAudio
 * @desc 分享一个音乐给好友
 *
 * @param {Object} param
 *
 * @param {String} param.title 标题
 * @param {String} param.desc 分享信息的描述
 * @param {String} param.share_url 点击后跳转的url
 * @param {String} param.image_url 图片url
 * @param {String} param.audio_url 音乐的url
 * @param {String} param.toUin 分享给指定好友或群
 * @param {Number} param.uinType uin的类型，0：好友；1：群
 * @param {String} param.appid 发起分享的应用appid
 * @param {String} param.report 上报的字段名
 *
 * @param {Function} callback 分享的回调
 * @param {Function} callback.result
 *
 * @example
 * mqq.ui.shareAudio({
 *     title: "尘埃落定",
 *     desc: "张敬轩",
 *     share_url: "http://y.qq.com/i/song.html?songid=5168274&source=qq",
 *     image_url: "http://url.cn/RjaawB",
 *     audio_url: "http://url.cn/QjaN70",
 *     toUin: "819611479",
 *     uinType: 0,
 *     appid: "100497308",
 *     report: "Music_gene_aio"
 * }, function(result) {
 *     alert(result);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 * @discard 1
 * @important 该接口即将抛弃，已不推荐使用，请统一使用shareMessage
 */

mqq.build('mqq.ui.shareAudio', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback, true);
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        mqq.invokeClient('nav', 'shareAudio', {
            'params': params,
            'callback': callbackName
        });
    },
    android: function(params, callback) {
        params['req_type'] = 2;
        if (callback) {
            params.callback = mqq.callback(callback, true);
        }
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        mqq.invokeClient('QQApi', 'shareMsg', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.shareMessage
 * @desc 调用客户端的分享接口，分享内容给好友/群，调用后会弹出联系人选择列表
 *
 * @param {Object} param
 *
 * @param {String} param.title 必填，消息标题，最长45字节
 * @param {String} param.desc 必填，消息摘要，最长60字节。
 * @param {Number} param.share_type 分享的目标类型，0：QQ好友；1：QQ空间；2：微信好友；3：微信朋友圈。默认为 0
 * @param {String} param.share_url 必填，点击消息后的跳转url，最长120字节。原 targetUrl 参数，可以继续使用 targetUrl
 * @param {String} param.image_url 必填，消息左侧缩略图url。图片推荐使用正方形，宽高不够时等比例撑满，不会变形。原 imageUrl 参数，可以继续使用 imageUrl。注意：图片最小需要200 * 200，否则分享到Qzone时会被Qzone过滤掉。
 * @param {Boolean} param.back 发送消息之后是否返回到web页面，默认false，直接到AIO，注：该参数只对share_type=0时起作用
 * @support for param.back iOS 5.0
 * @support for param.back android 4.7.2
 *
 * @param {String} param.shareElement 分享的类型，目前支持图文和音乐分享。news：图文分享类型，audio：音乐分享类型，video：视频分享类型。默认为news
 * @support for param.shareElement iOS 5.0
 * @support for param.shareElement android 5.0
 *
 * @param {String} param.flash_url 如果分享类型是音乐或者视频类型，则填写流媒体url
 * @support for param.flash_url iOS 5.0
 * @support for param.flash_url android 5.0
 *
 * @param {String} param.puin 公众帐号uin，用于自定义结构化消息尾巴，只在公众账号分享的时候填写，若不是请不要填，当puin没有索引到本地记录，则显示sourceName字段的文本，若没有sourceName字段，则直接显示puin数字
 * @support for param.puin iOS 5.0
 * @support for param.puin android 5.0
 *
 * @param {String} param.appid 来源 appid，在QQ互联申请的的 appid，如果有，可以填上
 * @support for param.appid iOS 5.0
 * @support for param.appid android 5.0
 *
 * @param {String} param.sourceName 消息来源名称，默认为空，优先读取 appid 对应的名字，如果没有则读取 puin 对应的公众账号名称
 * @param {String} param.toUin 分享给指定的好友或群，如果存在这个参数，则不拉起好友选择界面 (针对分享给好友)
 * @support for param.toUin iOS 5.0
 * @support for param.toUin android 5.0
 *
 * @param {Number} param.uinType 分享给指定的好友或群的uin类型: 0：好友；1：群 (针对分享给好友)
 * @support for param.uinType iOS 5.0
 * @support for param.uinType android 5.0
 *
 *
 * @param {Function} callback
 * @note for callback 分享到微信和朋友圈在手Q5.4之后开始支持回调
 * @param {Object} callback.result
 * @param {Number} callback.result.retCode 返回码
 * @options for callback.result.retCode 0：用户点击发送，完成整个分享流程
 * @options for callback.result.retCode 1：用户点击取消，中断分享流程
 * @options for callback.result.retCode -2：iOS端分享到微信或朋友圈时，手动取消分享将返回-2
 *
 * @important android6.2.1 bug 分享到空间回调值无效, 必为1, 修复方案待定(咨询hongxingcui)
 *
 * @support iOS 4.7.2
 * @support android 4.7.2
 *
 * @care 可自定义appid/source伪造任意来源的分享（QQ消息小尾巴）
 */

mqq.build('mqq.ui.shareMessage', {
    iOS: function(params, callback) {

        if (!('needPopBack' in params) && ('back' in params)) {
            params.needPopBack = params.back;
        }
        if (params['share_url']) {
            params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
        }
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        // 终端接受字符串类型UIN，这里统一帮忙处理
        if (params.toUin) {
            params.toUin += '';
        }
        // 兼容5.4版本
        if ( params.sourceName ) {
            params.srcName = params.sourceName
        }
        params['callback'] = mqq.callback(callback, true /*deleteOnExec*/ , true);
        mqq.invokeClient('nav', 'shareURLWebRichData', params);
    },
    android: function(params, callback) {
        if (params['share_url']) {
            params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
        }
        params['callback'] = mqq.callback(function(result) {
            callback && callback({
                retCode: result ? 0 : 1
            });
        }, true /*deleteOnExec*/ );
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        if( params.srcName ) {
            params.sourceName = params.srcName;
        }

        if (params['share_type'] && (params['share_type'] === 2 || params['share_type'] === 3) && mqq.compare('5.2') < 0 && mqq.support('mqq.app.isAppInstalled')) {

            // 先检查有没有安装微信, ios不用, ios会自己弹出一个 toast 提示
            // 5.2 android 也会自己检查
            var unsupportTips = '您尚未安装微信，不可使用此功能';
            mqq.app.isAppInstalled('com.tencent.mm', function(result) {
                if (result) {
                    mqq.invokeClient('QQApi', 'shareMsg', params);
                } else if (mqq.support('mqq.ui.showTips')) {
                    mqq.ui.showTips({
                        text: unsupportTips
                    });
                } else {
                    alert(unsupportTips);
                }

            });

        } else {
            mqq.invokeClient('QQApi', 'shareMsg', params);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7.2',
        android: '4.7.2'
    }
});
;/**
 * @function ui.shareRichMessage
 * @desc 以公众账号的身份调用native分享接口
 *
 * @param {Object} param
 *
 * @param {String} param.oaUin 公众账号uin
 * @param {String} param.title 消息标题
 * @param {String} param.summary 消息摘要
 * @param {String} param.targetUrl 点击消息后的跳转url
 * @param {String} param.imageUrl 消息左侧缩略图url
 * @param {String} [param.sourceName] 消息来源名称，默认为空，直接读取oaUin对应的公众账号名称
 * @param {Boolean} [param.back] 发送消息之后是否返回到web页面，默认NO，直接到AIO
 * @param {Function} [callback]
 * @param {Function} callback.result
 * @param {Function} callback.result.ret 0：用户点击发送，完成整个分享流程；1：用户点击取消，中断分享流程
 *
 * @support iOS 4.7
 * @support android 4.7
 * @discard 1
 * @important 该接口即将抛弃，已不推荐使用，请统一使用shareMessage
 */

mqq.build('mqq.ui.shareRichMessage', {
    iOS: function(params, callback) {

        // 参数容错
        params.puin = params.oaUin;
        params.desc = params.desc || params.summary;

        if (params['share_url']) {
            params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
        }
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        params.callback = mqq.callback(callback);
        mqq.invokeClient('nav', 'officalAccountShareRichMsg2QQ', params);
    },
    android: function(params, callback) {

        // 参数容错
        params.puin = params.oaUin;
        params.desc = params.desc || params.summary;
        if (params.desc) {
            params.desc = params.desc.length > 50 ? (params.desc.substring(0, 50) + '...') : params.desc;
        }
        if (mqq.compare('5.0') >= 0) {
            // 兼容依旧传 targetUrl 的调用
            params['share_url'] = params['share_url'] || params.targetUrl;
            params['image_url'] = params['image_url'] || params.imageUrl;

            if (params['share_url']) {
                params['share_url'] = mqq.removeQuery(params['share_url'], ['sid', '3g_sid']);
            }
            params.callback = callback ? mqq.callback(function(result) {
                callback({
                    ret: result ? 0 : 1
                });
            }) : null;

            mqq.invokeClient('QQApi', 'shareMsg', params);
        } else {

            params.targetUrl = params.targetUrl || params['share_url'];
            params.imageUrl = params.imageUrl || params['image_url'];

            if (params['targetUrl']) {
                params['targetUrl'] = mqq.removeQuery(params['targetUrl'], ['sid', '3g_sid']);
            }
            params.callback = mqq.callback(callback);
            mqq.invokeClient('publicAccount', 'officalAccountShareRichMsg2QQ', params);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});

// 兼容旧的归类
mqq.build('mqq.data.shareRichMessage', {
    iOS: mqq.ui.shareRichMessage,
    android: mqq.ui.shareRichMessage,
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.shareScreenshot
 * @desc 分享大图给好友
 *
 * @param {Object} param
 *
 * @param {String} param.briefMsg 分享消息描述，例如：'图片'
 * @support for param.briefMsg android 7.1.5
 * @support for param.briefMsg iOS 7.1.5 
 

 * @param {String} param.appName 分享应用名称，例如：'王者荣耀'
 * @support for param.appName android 7.1.5 
 * @support for param.appName iOS 7.1.5

 * @param {String} param.iconUrl 小尾巴图标，例如：'http://cdn.vip.qq.com/demo.png'
 * @support for param.iconUrl android 7.1.5
 * @support for param.iconUrl iOS 7.1.5

 * @param {String} param.actionUrl 跳转url，例如：'http://cdn.vip.qq.com'
 * @support for param.actionUrl android 7.1.5
 * @support for param.actionUrl iOS 7.1.5
 *

 * @param {String} param.callback 回调
 * @support for param.callback android 7.1.5
 * @support for param.callback iOS 7.1.5
 *

 *
 * @example
 * //设置导航栏为黑色背景、红色文字：
 * mqq.ui.shareScreenshot({briefMsg:'图片', appName:'王者荣耀'iconUrl:'http://cdn.vip.qq.com/demo.png', actionUrl:'http://cdn.vip.qq.com'});
 *
 * @support android 7.1.5
 * @support iOS 	7.1.5
 */;/**
 * @function ui.showActionSheet
 * @desc 弹出 ActionSheet
 *
 * @param {Object} param
 *
 * @param {String} param.title ActionSheet 标题
 * @param {String} param.cancel 指定取消按钮的标题
 * @param {String} param.close 指定关闭按钮的标题（该按钮为红色字体，仅支持iOS）
 * @support for param.close iOS 5.3
 * @support for param.close android not support
 * 
 * @param {Array|String} param.items 选项里表, 字符串
 *
 * @param {Function} callback
 * @param {Number} callback.type 点击按钮类型，具体取值参考下面
 * @options for callback.type 0: 点击了普通item
 * @options for callback.type 1: 点击了取消按钮或空白区域
 * @options for callback.type 2: 点击了关闭按钮
 * @param {Number} callback.index 点击的item的下标，从0开始
 *
 * @example
 * mqq.ui.showActionSheet({
 *     "title" : "title",
 *     "items" : ["item1", "item2"],
 *     "cancel" : "cancel",
 *     "close" : "close"
 * }, function(type, index){
 *     alert("type: " + type + ", index: " + index);
 * });
 *
 * @support iOS 4.7
 * @support android 4.7
 */

mqq.build('mqq.ui.showActionSheet', {
    iOS: function(params, callback) {
        if (callback) {
            params.onclick = mqq.callback(callback);
        }
        return mqq.invokeClient('ui', 'showActionSheet', params);
    },
    android: function(params, callback) {
        if (callback) {
            params.onclick = mqq.callback(callback);
        }
        return mqq.invokeClient('ui', 'showActionSheet', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.showBarAccountDetail
 * @desc 打开指定兴趣号资料卡
 *
 * @param {Object} param
 *
 * @param {String} param.uin 兴趣号的uin
 *
 * @support iOS 5.6
 * @support android 5.4
 */


mqq.build('mqq.ui.showBarAccountDetail', {
    iOS: function(param) {
        var parameter = (typeof param == 'object' ? param : {
            'uin': param
        });
        parameter.type = 3; // 因为iOS都是使用的showOfficalAccountDetail，以type做区分 1.公共账号，2.营销QQ，3.兴趣号
        mqq.invokeClient('nav', 'showOfficalAccountDetail', parameter);
    },
    android: function(params) {
        mqq.invokeClient('publicAccount', 'viewTroopBarAccount', params.uin);
    },
    supportInvoke: true,
    support: {
        iOS: '5.6',
        android: '5.4'
    }
});
;/**
 * @function ui.showDialog
 * @desc 弹出一个确认框
 *
 * @param {Object} param
 *
 * @param {String} param.title 确认框的标题
 * @param {String} param.text 确认框的提示内容
 * @param {Boolean} param.needOkBtn 是否显示确认按钮
 * @param {Boolean} param.needCancelBtn 是否显示取消按钮
 * @param {String} param.okBtnText 确认按钮的文本(默认为"确定")
 * @support for param.okBtnText iOS 5.0
 * @support for param.okBtnText android 5.0
 *
 * @param {String} param.cancelBtnText 取消按钮的文本(默认为"取消")
 * @support for param.cancelBtnText iOS 5.0
 * @support for param.cancelBtnText android 5.0
 *
 * @param {Function} callback
 * @param {Object} callback.result 点击按钮的返回结果
 * @param {Number} callback.result.button 指示用户点击的按钮, 0: 点击了确认按钮; 1: 点击了取消按钮
 *
 * @support iOS 4.6
 * @support android 4.6
 * @note needOkBtn 和 needCancelBtn 至少要有一个为 true
 *
 * @care 可弹出一个自定义内容的对话框，存在钓鱼推广风险
 */


mqq.build('mqq.ui.showDialog', {
    iOS: function(params, callback) {
        if (params) {
            params.callback = mqq.callback(callback, true /*deleteOnExec*/);
            params.title = params.title + '';
            params.text = params.text + '';
            if (!('needOkBtn' in params)) {
                params.needOkBtn = true;
            }
            if (!('needCancelBtn' in params)) {
                params.needCancelBtn = true;
            }
            // 字段兼容
            params.okBtnStr = params.okBtnText;
            params.cancelBtnStr = params.cancelBtnText;

            mqq.invokeClient('nav', 'showDialog', params);
        }
    },
    android: function(params, callback) {
        if (mqq.compare('4.8.0') >= 0) {
            params.callback = mqq.callback(callback, true);
            mqq.invokeClient('ui', 'showDialog', params);
        } else {
            var okCbName = '',
                cancelCbName = '';

            if (callback) {

                okCbName = mqq.callback(function() {
                    callback({
                        button: 0
                    });
                }, true);
                cancelCbName = mqq.callback(function() {
                    callback({
                        button: 1
                    });
                }, true);

                okCbName += '()';
                cancelCbName += '()';
            }
            params.title = params.title + '';
            params.text = params.text + '';
            if (!('needOkBtn' in params)) {
                params.needOkBtn = true;
            }
            if (!('needCancelBtn' in params)) {
                params.needCancelBtn = true;
            }
            mqq.invokeClient('publicAccount', 'showDialog', params.title, params.text,
                params.needOkBtn, params.needCancelBtn, okCbName, cancelCbName);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.6',
        android: '4.6'
    }
});
;/**
 * @function ui.showEQQ
 * @desc 打开指定QQ商家的资料卡
 *
 * @param {Object} param
 *
 * @param {String} param.uin QQ商家的uin
 *
 * @support iOS 4.7
 * @support android 4.7
 * @discard 1
 * @important 该接口即将抛弃，已不推荐使用
 */

mqq.build('mqq.ui.showEQQ', {
    iOS: function(params) {
        mqq.invokeClient('nav', 'showBusinessAccountProfile', params);
    },
    android: function(params) {
        mqq.invokeClient('eqq', 'showEQQ', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.showOfficalAccountDetail
 * @desc 打开指定公众帐号的详情页
 *
 * @param {Object} param
 *
 * @param {String} param.uin 公众帐号的uin
 * @param {Boolean} param.showAIO 为true时, 如果用户关注了该公众帐号, 将打开该公众帐号的AIO; 如果未关注, 则打开详情页
 * @support for param.showAIO iOS 4.6
 * @support for param.showAIO android 4.6
 *
 * @support iOS 4.5
 * @support android 4.6
 * @note v4.6 开始支持 showAIO 参数
 */


mqq.build('mqq.ui.showOfficalAccountDetail', {
    iOS: function(param) {
        var parameter = (typeof param == 'object' ? param : {
            'uin': param
        });
        mqq.invokeClient('nav', 'showOfficalAccountDetail', parameter);

    },
    android: function(params) {
        if (mqq.compare('4.6') >= 0) {
            mqq.invokeClient('publicAccount', 'viewAccount', params.uin, params.showAIO);
        } else {
            mqq.invokeClient('publicAccount', 'viewAccount', params.uin);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});
;/**
 * @function ui.showOfficialAccountProfile
 * @desc 打开指定公众帐号资料卡，不支持打开AIO
 *
 * @param {Object} param
 *
 * @param {String} param.uin 公众帐号的uin
 *
 * @support iOS 4.5
 * @support android 4.6
 */


mqq.build('mqq.ui.showOfficialAccountProfile', {
    iOS: function(param) {
        if (mqq.compare('6.0') >= 0) {
            mqq.invokeClient('publicAccount', 'showOfficialAccountProfile', param);
        } else {
            param.showAIO = false;
            mqq.invokeClient('nav', 'showOfficalAccountDetail', param);
        }
    },
    android: function(param) {
        if (mqq.compare('6.0') >= 0) {
            mqq.invokeClient('publicAccountNew', 'showOfficialAccountProfile', param);
        } else if (mqq.compare('4.6') >= 0) {
            mqq.invokeClient('publicAccount', 'viewAccount', param.uin, false);
        } else {
            mqq.invokeClient('publicAccount', 'viewAccount', param.uin);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.6'
    }
});;/**
 * @function ui.showProfile
 * @desc 打开指定uin的资料卡
 *
 * @param {Object} param
 *
 * @param {String} param.uin
 * @param {Number} param.uinType 指定 uin 的类型，默认为个人资料卡，指定为 1 则打开群资料卡
 * @support for param.uinType iOS 4.7
 * @support for param.uinType android 4.7
 *
 * @support iOS 4.5
 * @support android 4.5
 * @note 该接口从 4.6 才开始添加，4.7 才支持 uinType 参数，但客户端以前提供过打开资料卡的 schema 接口，可以兼容到 4.5 版本，所以实际上该接口在 4.5 以上的客户端都能使用
 * @change v4.7: 增加 uinType 的支持
 */

mqq.build('mqq.ui.showProfile', {
    iOS: function(params) {
        if (mqq.compare('4.7') >= 0) {
            // hack ios 6.3.5, uin需传字符串
            params.uin += '';
            mqq.invokeClient('nav', 'showProfile', params);
        } else if (mqq.compare('4.6') >= 0 && !params.uinType) {
            // 4.6 版本不支持 type 参数
            mqq.invokeClient('nav', 'showProfile', params);
        } else { // 低版本使用 schema 接口

            if (params.uinType === 1) {
                params['card_type'] = 'group';
            }
            mqq.invokeSchema('mqqapi', 'card', 'show_pslcard', params);
        }
    },
    android: function(params) {
        if (mqq.compare('4.7') >= 0) {

            mqq.invokeClient('publicAccount', 'showProfile', params);
        } else if (mqq.compare('4.6') >= 0 && !params.uinType) {
            // 4.6 版本不支持 type 参数
            mqq.invokeClient('publicAccount', 'showProfile', params.uin);
        } else { // 低版本使用 schema 接口

            if (params.uinType === 1) {
                params['card_type'] = 'group';
            }
            mqq.invokeSchema('mqqapi', 'card', 'show_pslcard', params);
        }
    },
    supportInvoke: true,
    support: {
        iOS: '4.5',
        android: '4.5'
    }
});
;/**
 * @function ui.showShareMenu
 * @desc 唤起分享面板，就是默认情况下点击 WebView 右上角的按钮时弹出的面板
 *
 * @support iOS 5.2
 * @support android 5.2
 */

mqq.build('mqq.ui.showShareMenu', {
    iOS: function() {
        mqq.invokeClient('ui', 'showShareMenu');
    },
    android: function() {
        mqq.invokeClient('ui', 'showShareMenu');
    },
    supportInvoke: true,
    support: {
        iOS: '5.2',
        android: '5.2'
    }
});
;/**
 * @function ui.showTips
 * @desc 弹出文本的toast提示，2秒后消失
 *
 * @param {Object} param
 *
 * @param {String} param.text 要提示的文字内容
 * @param {Number} [param.iconMode] icon类型
 * @default for param.iconMode 2
 * @options for param.iconMode 1: 勾选图标
 * @options for param.iconMode 2: 空心警告图标
 * @support for param.iconMode iOS 5.7
 * @support for param.iconMode android 5.7
 *
 * @example
 * mqq.ui.showTips({
 *    text: "hello",
 *    iconMode: 2
 * })
 *
 * @support iOS 4.7
 * @support android 4.7
 *
 * @care 可弹出一个自定义内容的toast提示,存在钓鱼推广风险
 */


mqq.build('mqq.ui.showTips', {
    iOS: function(params) {

        params.iconMode = params.iconMode || 2;
        mqq.invokeClient('ui', 'showTips', params);
    },
    android: function(params) {

        params.iconMode = params.iconMode || 2;
        mqq.invokeClient('ui', 'showTips', params);
    },
    supportInvoke: true,
    support: {
        iOS: '4.7',
        android: '4.7'
    }
});
;/**
 * @function ui.webviewCanScroll
 * @desc  禁止webview下拉回弹效果
 *
 * @param {Object} params 参数
 * @param {Boolean} params.enable 禁止字段，false:禁止 true:开启
 * 
 * @example
 * mqq.invoke('ui', 'webviewCanScroll', {"enable" : false});
 * 
 * @note 注意：该接口直接使用`mqq.invoke`调用，不支持`mqq.ui.webviewCanScroll`
 *
 * @support iOS 5.8
 * @support Android 5.8
 */;/**
 * @namespace viewTracks
 * @desc 手Q漏斗上报webview接口,漏斗上报模型用于记录手Q从主页面逐级进入到各个页面，最终到开通会员（或超会）页面的路径
 */

/**
 * @function viewTracks.getTrackInfo
 * @desc 获取当前track的信息
 *
 * @param {Object} param 暂无参数，预留值
 * @param {Function} callback 查询成功/失败的回调
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.result 返回码，0为查询成功，非0为查询失败
 * @param {Object} callback.result.data 返回值
 * @param {String} callback.result.data.path 当前用户经过的路径
 * @param {String} callback.result.data.token 路径的token
 *
 * @example
 * mqq.viewTracks.getTrackInfo({}, function(result){
 *     console.log(result.result);
 *     console.log(result.data.path);
 *     console.log(result.data.token);
 * });
 *
 * @important 此接口自手Q5.5版本后已废弃
 * @support iOS 5.1
 * @support android 5.1
 */

mqq.build('mqq.viewTracks.getTrackInfo', {
    iOS: function(params, callback) {
        params = params || {};

        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'getTrackInfo', params);
    },
    android: function(params, callback) {
        params = params || {};

        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'getTrackInfo', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.1',
        android: '5.1'
    }
});
;/**
 * @function viewTracks.pop
 * @desc 删除当前路径中最后一个节点
 *
 * @param {Object} param 暂无参数，预留值
 * @param {Function} callback 查询成功/失败的回调
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.result 返回码，0为查询成功，非0为查询失败
 *
 * @example
 * mqq.viewTracks.pop({}, function(result){
 *     console.log(result.result);
 * });
 *
 * @important 此接口自手Q5.5版本后已废弃
 * @support iOS 5.1
 * @support android 5.1
 */

mqq.build('mqq.viewTracks.pop', {
    iOS: function(params, callback) {
        params = params || {};

        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'pop', params);
    },
    android: function(params, callback) {
        params = params || {};

        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'pop', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.1',
        android: '5.1'
    }
});
;/**
 * @function viewTracks.push
 * @desc 将当前页面的路径id传给客户端，由客户端将id加入路径信息
 *
 * @param {Object} param
 * @param {Number} param.id 要加入的页面路径的id，id由客户端定义，具体可联系iOS的fingerluo或Android的kanedong
 * @param {Number} param.isReport 是否上报，1为上报，0为不上报
 * @param {Function} callback 查询成功/失败的回调
 * @param {Object} callback.result 返回值
 * @param {Number} callback.result.result 返回码，0为查询成功，非0为查询失败
 *
 * @example
 * mqq.viewTracks.push({id:10, isReport:1}, function(result){
 *     console.log(result.result);
 * });
 *
 * @important 此接口自手Q5.5版本后已废弃
 * @support iOS 5.1
 * @support android 5.1
 */

mqq.build('mqq.viewTracks.push', {
    iOS: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'push', params);
    },
    android: function(params, callback) {
        var callbackName = mqq.callback(callback);
        if (callbackName) {
            params.callback = callbackName;
        }
        mqq.invokeClient('viewTracks', 'push', params);
    },
    supportInvoke: true,
    support: {
        iOS: '5.1',
        android: '5.1'
    }
});
