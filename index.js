var fs = require('fs'),
    sysPath = require('path'),
    cpr = require('cpr'),
    ignore = require('ignore'),
    execSync = require('child_process').execSync;

var folder = '.fekit_module_tmp';

exports.usage = '通过git安装fekit module';

exports.set_options = function(optimist) {
    optimist.alias('b', 'branch');
    optimist.describe('b', '选择分支，默认 master');
    optimist.alias('t', 'tag');
    optimist.describe('t', '选择tag');
    return optimist;
};

exports.run = function(options) {
    var gitPath = options['_'][1],
        fekitModulePath = sysPath.join(options.cwd, 'fekit_modules'),
        tmpFolder = sysPath.join(fekitModulePath, folder),
        cloneCmd = 'git clone ' + gitPath + ' ' + folder,
        tagCmd = 'git checkout ',
        branch, tag,
        proFekitConfig,
        modFekitConfig,
        moduleName,
        moduleVersion,
        modulePath,
        ig;

    function rmTmp() {
        execSync('rm -rf ' + folder, {
            cwd: fekitModulePath
        });
    }

    if (!fs.existsSync(fekitModulePath)) {
        fs.mkdirSync(fekitModulePath);
    }

    if (fs.existsSync(tmpFolder)) {
        rmTmp();
    }

    // Clone
    if (options.b && options.b !== true) {
        branch = options.b;
        cloneCmd += ' -b ' + branch;
    }

    execSync(cloneCmd, {
        cwd: fekitModulePath
    });

    // Tag
    if (options.t && options.t != true) {
        tag = options.t;
        tagCmd += tag;

        execSync(tagCmd, {
            cwd: tmpFolder
        });
    }

    // remove .git
    execSync('rm -rf .git', {
        cwd: tmpFolder
    });

    // 获取模块信息
    try {
        modFekitConfig = JSON.parse(fs.readFileSync(sysPath.join(tmpFolder, 'fekit.config')));
    } catch(e) {
        rmTmp();
        throw new Error('模块 fekit.config 解析失败！');
    }

    moduleName = modFekitConfig.name;
    moduleVersion = modFekitConfig.version;
    modulePath = sysPath.join(fekitModulePath, moduleName);
    // 添加配置信息
    modFekitConfig.source = {
        git: gitPath,
        branch: branch || false,
        tag: tag || false
    };
    fs.writeFileSync(sysPath.join(tmpFolder, 'fekit.config'), JSON.stringify(modFekitConfig, null, 4), false);

    // 更改项目依赖配置
    try {
        proFekitConfig = JSON.parse(fs.readFileSync(sysPath.join(options.cwd, 'fekit.config'), 'UTF-8'));
    } catch(e) {
        rmTmp();
        throw new Error('项目 fekit.config 解析失败！');
    }

    proFekitConfig.dependencies = proFekitConfig.dependencies || {};
    proFekitConfig.dependencies[moduleName] = moduleVersion;
    fs.writeFileSync(sysPath.join(options.cwd, 'fekit.config'), JSON.stringify(proFekitConfig, null, 4), 'UTF-8');

    // 拷贝目录
    ig = ignore().addIgnoreFile(sysPath.join(tmpFolder, '.fekitignore'));

    cpr(tmpFolder, modulePath, {
        deleteFirst: true,
        overwrite: true,
        confirm: false,
        filter: function(path) {
            var rPath = sysPath.relative(options.cwd, path),
                pPath = sysPath.relative(tmpFolder, path);
            if (pPath.indexOf('.') === 0) {
                return false;
            } else if (!ig.filter([rPath]).length) {
                return false;
            }
            return true;
        }
    }, function(err) {
        rmTmp();
        if (err) {
            throw err;
        } else {
            execSync('fekit install', {
                cwd: modulePath
            });
            console.log('****** 安装 ' + moduleName + '@' + moduleVersion + ' 成功！******');
        }

    });

};

