
//node http_monitor.js http://www.google.pt 1768 "1,1,1" "" "" "GET#200#####"
var urlLib = require("url");


//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Error.prototype;


function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Error.prototype;

function InvalidParametersError() {
    this.name = "InvalidParametersError";
    this.message = ("Invalid value in parameters (staus code).");
}
InvalidParametersError.prototype = Error.prototype;



// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//url
	var url = args[0];
	
	//target id
	var targetId = args[1];
	
	//metric state
	var metricState = args[2].replace("\"", "");
	
	var tokens = metricState.split(",");

	var checkStatus = false;
	var checkTimeout = false;
	var checkStatusCode = false;
	
	if (tokens.length == 3)
	{
		if (tokens[0] == "1")
		{
			checkStatus = true;
		}

		if (tokens[1] == "1")
		{
			checkTimeout = true;
		}
		
		if (tokens[2] == "1")
		{
			checkStatusCode = true;
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	
	// Username
	var username = args[3];
	username = username.length === 0 ? null : username;
	
	// Password
	var passwd = args[4];
	passwd = passwd.length === 0 ? null : passwd;
	
	// Parameters (list)
	var parameters = args[5].replace("\"", "");
	var method, statusCodes, needle, timeout = 60000 , requestParameters, contentType;
	
	try
	{
		var parts = parameters.split("#", 6);
		
		method = parts[0];
	
		statusCodes = parseStatusCodes(parts[1]);
		needle = parts[2];
	
		if (parts[3])
		{
			timeout = parts[3];
		}

		requestParameters = parts[4];
		contentType = parts[5];

	}
	catch(err)
	{
		throw err;
	}	

	monitorHTTP(url, targetId, checkStatus, checkTimeout, checkStatusCode, username, passwd, method, statusCodes, needle, timeout, requestParameters, contentType);
	
}



function parseStatusCodes(statusCode)
{
	var codes = [];
	
	if(!statusCode)
		return codes;
	
	var tokens = statusCode.split(",");
	
	for (var i in tokens)
	{
		var token = tokens[i];
		
		if (token.indexOf("-") != -1)
		{
			// Range.
			var range = token.split("-");
			var start = range[0]; // Start
			var end = range[1]; // End

			if (end >= start)
			{
				for (; start <= end; start++)
				{
					codes.push(start);
				}
			}
			else
			{
				throw new InvalidParametersError();
			}
		}
		else
		{
			// Single code.
			codes.push(token);
		}
	}

	return codes;
}



//################### OUTPUT ###########################

function output(metrics, targetId)
{
	var out = "";
	
	for(var i in metrics)
	{
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val
		out += "\n";
		
	}
	console.log(out);
}



// ################# MONITOR ###########################

function monitorHTTP(url, targetId, checkStatus, checkTimeout, checkStatusCode, username, passwd, method, statusCodes, needle, timeout, requestParameters, contentType) {

	var metrics = [];

    this.validateHTTPCode = function (codes, code) {
        for (var i in codes) 
		{
            if(parseInt(codes[0]) == code)
				return true;
        }
		
        return false;
    }

    var start = Date.now();
    var fail = false;
    var _url = urlLib.parse(url);

	var http;
	var default_port;
	
	if (urlLib.parse(url).protocol == 'http:') 
	{
		http = require("http");
		default_port = 80;
	}
	else
	{
		http = require("https");
		default_port = 443;
	}
	
    var options;
    options = {
        hostname: _url.hostname,
        path: _url.pathname + ((requestParameters != '') ? requestParameters : ''),
        method: method,
        port: (_url.port == undefined ? default_port : _url.port),
        auth: '',
        headers: ''
    };

    if (username != null && passwd != null) {
        options.auth = username + ':' + passwd;
    }

    if (contentType != '') //If Post
    {
        switch (contentType) {
            case '0':
                contentType = 'application/x-www-form-urlencoded';
                break;
            case '1':
                contentType = 'application/json';
                break;
            case '2':
                contentType = 'application/xml';
                break;
        }
        options.path = _url.pathname;
        options.headers = {
            'Content-Type': contentType,
            'Content-Length': requestParameters.length
        }
    }

    //console.log(options);
    var req = http.request(options, function (res) {
        var data = '';
		
        var code = res.statusCode;
        res.setEncoding('utf8');
        // On each chunk
        res.on('data', function (chunk) {
            data += chunk;
        });
        // On End
        res.on('end', function (res) {
		
            if (statusCodes.length > 0 && !validateHTTPCode(statusCodes, code)) {
                //console.log(JSON.stringify(statusCodes) + ' Fail StatusCode ' + code + '|' + url);
                fail = true;
            }
            if (needle != '' && data.indexOf(needle) == -1) {
                fail = true;
            }
            if (timeout != '' && (timeout < (Date.now() - start))) {
                //console.log(timeout + ' Fail MaxResponseTime ' + url);
                fail = true;
            }
            if (fail) {
                //Availability
                if (checkStatus) {
                    var metric = new Object();
                    metric.id = '157:9';
                    metric.val = '0';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (checkStatusCode) {
                    var metric = new Object();
                    metric.id = '776:4';
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
            } else {
                //Availability
                if (checkStatus) {
                    var metric = new Object();
                    metric.id = '157:9';
                    metric.val = '1';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Response Time
                if (checkTimeout) {
                    var metric = new Object();
                    metric.id = '60:7';
                    metric.val = Date.now() - start;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (checkStatusCode) {
                    var metric = new Object();
                    metric.id = '776:4';
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
            }

			output(metrics, targetId)

        });
    });
    // On Error
    req.on('error', function (e) {
        fail = true;
        console.log('fail0:' + e);
        var metric = new Object();
        //Availability
        metric.id = '157:9';
        metric.val = '0';
        metric.ts = start;
        metric.exec = Date.now() - start;
        metrics.push(metric);
		
		output(metrics, targetId)
    });

    if (method == 'POST') {
        req.write(requestParameters);
    }
    req.end();
}
