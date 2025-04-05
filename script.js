document.addEventListener('DOMContentLoaded', function() {
    // 检查是否在MobileQQ环境中
    function checkMobileQQ() {
        if (typeof mqq === 'undefined') {
            document.getElementById('result').innerHTML = 
                '<p style="color:red;">错误：此功能需要在MobileQQ中运行</p>';
            return false;
        }
        return true;
    }

    // 分享到QQ好友
    document.getElementById('share-qq').addEventListener('click', function() {
        if (!checkMobileQQ()) return;
        
        const title = document.getElementById('title').value || '默认标题';
        const desc = document.getElementById('desc').value || '默认描述';
        const url = document.getElementById('url').value || 'http://www.qq.com';
        const image = document.getElementById('image').value || '';
        
        mqq.ui.shareMessage({
            title: title,
            desc: desc,
            share_url: url,
            share_type: 0,  // 0表示QQ好友
            image_url: image,
            back: true
        }, function(result) {
            const resultEl = document.getElementById('result');
            if (result.retCode === 0) {
                resultEl.innerHTML = '<p style="color:green;">分享成功!</p>';
            } else {
                resultEl.innerHTML = `<p style="color:red;">分享失败, 错误码: ${result.retCode}</p>`;
            }
        });
    });

    // 分享到QQ空间
    document.getElementById('share-qzone').addEventListener('click', function() {
        if (!checkMobileQQ()) return;
        
        const title = document.getElementById('title').value || '默认标题';
        const desc = document.getElementById('desc').value || '默认描述';
        const url = document.getElementById('url').value || 'http://www.qq.com';
        const image = document.getElementById('image').value || '';
        
        mqq.ui.shareMessage({
            title: title,
            desc: desc,
            share_url: url,
            share_type: 1,  // 1表示QQ空间
            image_url: image,
            back: true
        }, function(result) {
            const resultEl = document.getElementById('result');
            if (result.retCode === 0) {
                resultEl.innerHTML = '<p style="color:green;">分享成功!</p>';
            } else {
                resultEl.innerHTML = `<p style="color:red;">分享失败, 错误码: ${result.retCode}</p>`;
            }
        });
    });

    // 分享到微信
    document.getElementById('share-wechat').addEventListener('click', function() {
        if (!checkMobileQQ()) return;
        
        const title = document.getElementById('title').value || '默认标题';
        const desc = document.getElementById('desc').value || '默认描述';
        const url = document.getElementById('url').value || 'http://www.qq.com';
        const image = document.getElementById('image').value || '';
        
        mqq.ui.shareMessage({
            title: title,
            desc: desc,
            share_url: url,
            share_type: 2,  // 2表示微信
            image_url: image,
            back: true
        }, function(result) {
            const resultEl = document.getElementById('result');
            if (result.retCode === 0) {
                resultEl.innerHTML = '<p style="color:green;">分享成功!</p>';
            } else {
                resultEl.innerHTML = `<p style="color:red;">分享失败, 错误码: ${result.retCode}</p>`;
            }
        });
    });

    // 初始化默认值
    document.getElementById('url').value = window.location.href;
});