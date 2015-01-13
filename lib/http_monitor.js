
var urlLib = require("url");

var metricAvailabilityId = '157:Availability:9';
var metricResponseTimeId = '60:Response Time:7';
var metricStatusId = '776:Status Code:4';

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;

function InvalidParametersError() 
{
    this.name = "InvalidParametersError";
    this.message = "Invalid parameters number.";
	this.code = 10;
}
InvalidParametersError.prototype = Object.create(Error.prototype);
InvalidParametersError.prototype.constructor = InvalidParametersError;


function InvalidStatusCodeError()
{
	this.name = "InvalidStatusCodeError";
	this.message = ("Invalid values in status code.");
	this.code = 23;
}
InvalidStatusCodeError.prototype = Object.create(Error.prototype);
InvalidStatusCodeError.prototype.constructor = InvalidStatusCodeError;


// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidParametersError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidStatusCodeError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//url
	var url = args[0];
	
	//metric state
	var metricState = args[1].replace("\"", "");
	
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
	var username = args[2];
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	username = username.length === 0 ? null : username;
		
	
	// Password
	var passwd = args[3];
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	passwd = passwd.length === 0 ? null : passwd;
	
	// Parameters (list)
	var parameters = args[4].replace("\"", "");
	var method, statusCodes, needle, timeout = 60000 , requestParameters, contentType;
	
	try
	{
		var parts = parameters.split("#", 6);
		
		if(parts.length != 6)
		{
			throw new InvalidParametersError();
		}
		
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

	monitorHTTP(url, checkStatus, checkTimeout, checkStatusCode, username, passwd, method, statusCodes, needle, timeout, requestParameters, contentType);
	
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
				throw new InvalidStatusCodeError();
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

function output(metrics)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		
		console.log(out);
	}
	
}



// ################# MONITOR ###########################

function monitorHTTP(url, checkStatus, checkTimeout, checkStatusCode, username, passwd, method, statusCodes, needle, timeout, requestParameters, contentType) {

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
                fail = true;
            }
            if (needle != '' && data.indexOf(needle) == -1) {
                fail = true;
            }
            if (timeout != '' && (timeout < (Date.now() - start))) {
                fail = true;
            }
            if (fail) {
                //Availability
                if (checkStatus) {
                    var metric = new Object();
                    metric.id = metricAvailabilityId;
                    metric.val = '0';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (checkStatusCode) {
                    var metric = new Object();
                    metric.id = metricStatusId;
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
            } else {
                //Availability
                if (checkStatus) {
                    var metric = new Object();
                    metric.id = metricAvailabilityId;
                    metric.val = '1';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Response Time
                if (checkTimeout) {
                    var metric = new Object();
                    metric.id = metricResponseTimeId;
                    metric.val = Date.now() - start;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (checkStatusCode) {
                    var metric = new Object();
                    metric.id = metricStatusId;
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
            }

			output(metrics)

        });
    });
    // On Error
    req.on('error', function (e) {
        fail = true;
		
		//Availability
        var metric = new Object();
        metric.id = metricAvailabilityId;
        metric.val = '0';
        metric.ts = start;
        metric.exec = Date.now() - start;
        metrics.push(metric);
		
		output(metrics)
    });

    if (method == 'POST') {
        req.write(requestParameters);
    }
    req.end();
}
