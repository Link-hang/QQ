document.addEventListener('DOMContentLoaded', function() {
    const groupNumberInput = document.getElementById('group-number');
    const jumpBtn = document.getElementById('jump-btn');
    const resultSection = document.getElementById('result');
    const statusIcon = resultSection.querySelector('.status-icon');
    const statusText = resultSection.querySelector('p');
    
    // 检查是否在QQ环境中
    function isInQQ() {
        return navigator.userAgent.indexOf('QQ/') > -1 && 
               navigator.userAgent.indexOf('Mobile') > -1;
    }
    
    // 更新状态显示
    function updateStatus(type, message) {
        let icon = 'ℹ️';
        let color = '#12B7F5';
        
        switch(type) {
            case 'success':
                icon = '✅';
                color = '#52C41A';
                break;
            case 'error':
                icon = '❌';
                color = '#FF4D4F';
                break;
            case 'warning':
                icon = '⚠️';
                color = '#FAAD14';
                break;
        }
        
        statusIcon.textContent = icon;
        statusText.textContent = message;
        resultSection.style.borderLeftColor = color;
        resultSection.style.backgroundColor = `rgba(${parseInt(color.slice(1,3), 16}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)}, 0.08)`;
    }
    
    // 生成QQ群���转链接
    function generateGroupLink(groupNumber) {
        return [
            `mqqapi://card/show_pslcard?src_type=internal&card_type=group&uin=${groupNumber}`,
            `mqqapi://qun/chat?groupUin=${groupNumber}`
        ];
    }
    
    // 尝试跳转到QQ群
    function jumpToGroup(groupNumber) {
        if (!groupNumber || !/^\d{5,10}$/.test(groupNumber)) {
            updateStatus('error', '请输入有效的QQ群号码(5-10位数字)');
            groupNumberInput.focus();
            return;
        }
        
        if (!isInQQ()) {
            updateStatus('warning', '请在手机QQ中打开此页面使用跳转功能');
            
            // 创建临时元素复制链接
            const tempInput = document.createElement('input');
            tempInput.value = `mqqapi://card/show_pslcard?src_type=internal&card_type=group&uin=${groupNumber}`;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            
            statusText.innerHTML += '<br><small>已复制跳转链接到剪贴板</small>';
            return;
        }
        
        updateStatus('success', `正在跳转到QQ群: ${groupNumber}...`);
        
        const links = generateGroupLink(groupNumber);
        let success = false;
        
        // 尝试所有可能的跳转方式
        links.forEach(link => {
            if (!success) {
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.src = link;
                document.body.appendChild(iframe);
                
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
                
                // 设置超时检查是否跳转成功
                setTimeout(() => {
                    if (!success) {
                        updateStatus('error', `跳转失败，请尝试手动在QQ中搜索群号: ${groupNumber}`);
                    }
                }, 1500);
                
                // 假设跳转成功
                success = true;
            }
        });
    }
    
    // 绑定按钮点击事件
    jumpBtn.addEventListener('click', function() {
        const groupNumber = groupNumberInput.value.trim();
        jumpToGroup(groupNumber);
    });
    
    // 绑定回车键事件
    groupNumberInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            jumpToGroup(groupNumberInput.value.trim());
        }
    });
    
    // 初始检测环境
    if (!isInQQ()) {
        updateStatus('warning', '请在手机QQ中打开此页面使用跳转功能');
    } else {
        updateStatus('info', '输入QQ群号码后点击跳转按钮');
    }
    
    // 输入框获取焦点
    groupNumberInput.focus();
});