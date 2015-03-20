/**
* This script was developed by Guberni and is part of Tellki's Monitoring Solution
*
* February, 2015
* 
* Version 1.0
*
* DESCRIPTION: Monitor HTTP utilization
*
* SYNTAX: node http_monitor.js <HOST> <METRIC_STATE> <USER_NAME> <PASS_WORD> <PARAMS>
* 
* EXAMPLE: node http_monitor.js "http://www.guberni.com" "1,1,0" "user" "pwd" "GET#200#####"
*
* README:
*		<HOST> Site URL or ip address.
*
*		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
*		1 - metric is on ; 0 - metric is off
*
*		<USER_NAME>, <PASS_WORD> are only required if you want to monitor a password protected site. If you want to use this
*		script to monitor a non password protected site, leave this parameters empty ("") but you still need to
*		pass them to the script.
*
*		<PARAMS> are 7 fields separeted by "#" and it contains the monitor's configuration, is generated internally
*		by Tellki and it's only used by Tellki's default monitors.
**/


var urlLib = require("url");

// METRICS IDS
var metricAvailabilityId = '157:Availability:9';
var metricResponseTimeId = '60:Response Time:4';
var metricStatusId = '776:Status Code:4';


// ############# INPUT ###################################

//START
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


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorHTTP)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<HOST>
	var url = args[0];
	
	//<METRIC_STATE>
	var metricState = args[1].replace("\"", "");
	var tokens = metricState.split(",");

	// metric Availability state
	var checkStatus = false;
	// metric Response time state
	var checkTimeout = false;
	// metric Status state
	var checkStatusCode = false;
	
	
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

	
	// <USER_NAME>
	var username = args[2];
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	username = username.length === 0 ? null : username;
		
	
	// <PASS_WORD>
	var passwd = args[3];
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	passwd = passwd.length === 0 ? null : passwd;
	
	// <PARAMS>
	var parameters = args[4].replace("\"", "");
	var method, statusCodes, needle, timeout = 60000 , requestParameters, contentType;
	
	
	try
	{
		var parts = parameters.split("#", 6);
		
		//http method
		method = parts[0];
	
		//process status code
		statusCodes = parseStatusCodes(parts[1]);
		
		//body must contains
		needle = parts[2];
	
		// max response time
		if (parts[3])
		{
			timeout = parts[3];
		}
		
		//query string
		requestParameters = parts[4];
		
		//content type
		contentType = parts[5];
	
	}
	catch(err)
	{
		throw err;
	}	

	
	//create request object to pass to the monitor
	var request = new Object()
	request.url = url
	request.checkStatus = checkStatus
	request.checkTimeout = checkTimeout
	request.checkStatusCode = checkStatusCode
	request.username = username
	request.passwd = passwd
	request.method = method
	request.statusCodes = statusCodes
	request.needle = needle
	request.timeout = timeout
	request.requestParameters = requestParameters
	request.contentType = contentType
	
	//call monitor
	monitorHTTP(request);
	
}


/*
* Create a list with http status codes
* Receive: http status code interval (or single code)
* Returns: status codes list between passed interval (or list with the single status code). 
*/
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



//################# HTTP CHECK ###########################

/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorHTTP(request) {

	var metrics = [];

	/*
	* Validate http response status code agains configuration status codes
	* Return: true if match, false otherwise
	*/
    this.validateHTTPCode = function (codes, code) {
        for (var i in codes) 
		{
            if(parseInt(codes[0]) == code)
				return true;
        }
		
        return false;
    }

	//start time to measure response time
    var start = Date.now();
	
    var fail = false;
    var _url = urlLib.parse(request.url);

	var http;
	var default_port;
	
	//select type of module to use (http or https)
	if (_url.protocol == 'http:') 
	{
		http = require("http");
		default_port = 80;
	}
	else
	{
		http = require("https");
		default_port = 443;
	}
	
	// create http request options
    var options;
    options = {
        hostname: _url.hostname,
        path: _url.pathname + ((request.requestParameters != '') ? request.requestParameters : ''),
        method: request.method,
        port: (_url.port == undefined ? default_port : _url.port),
        auth: '',
        headers: ''
    };

    if (request.username != null && request.passwd != null) {
        options.auth = request.username + ':' + request.passwd;
    }

    if (request.contentType != '') //If Post
    {
        switch (request.contentType) {
            case '0':
                request.contentType = 'application/x-www-form-urlencoded';
                break;
            case '1':
                request.contentType = 'application/json';
                break;
            case '2':
                request.contentType = 'application/xml';
                break;
        }
        options.path = _url.pathname;
        options.headers = {
            'Content-Type': request.contentType,
            'Content-Length': requestParameters.length
        }
    }

	//do http request
    var req = http.request(options, function (res) {
        var data = '';
		
		//http response status code 
        var code = res.statusCode;
        res.setEncoding('utf8');
		
        // receive data
        res.on('data', function (chunk) {
            data += chunk;
        });
		
        // On http request end
        res.on('end', function (res) {
		
			// compare status code
            if (request.statusCodes.length > 0 && !validateHTTPCode(request.statusCodes, code)) {
                fail = true;
            }
			// body must contain string test
            if (request.needle != '' && data.indexOf(request.needle) == -1) {
                fail = true;
            }
			// compare max timeout defined on config with time request
            if (request.timeout != '' && (request.timeout < (Date.now() - start))) {
                fail = true;
            }
			
			//on test fail retrieves metric Availability set to 0 (not available) and Status Code 
            if (fail) {
                //Availability
                if (request.checkStatus) {
                    var metric = new Object();
                    metric.id = metricAvailabilityId;
                    metric.val = '0';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (request.checkStatusCode) {
                    var metric = new Object();
                    metric.id = metricStatusId;
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
				
			//on success retrieves all metrics
            } else {
                //Availability
                if (request.checkStatus) {
                    var metric = new Object();
                    metric.id = metricAvailabilityId;
                    metric.val = '1';
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Response Time
                if (request.checkTimeout) {
                    var metric = new Object();
                    metric.id = metricResponseTimeId;
                    metric.val = Date.now() - start;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
                //Status Code
                if (request.checkStatusCode) {
                    var metric = new Object();
                    metric.id = metricStatusId;
                    metric.val = code;
                    metric.ts = start;
                    metric.exec = Date.now() - start;
                    metrics.push(metric);
                }
            }

			outputMetrics(metrics)

        });
    });
    // On Error retrieves metric Availability set to 0 (not available)
    req.on('error', function (e) {
        fail = true;
		
		//Availability
        var metric = new Object();
        metric.id = metricAvailabilityId;
        metric.val = '0';
        metric.ts = start;
        metric.exec = Date.now() - start;
        metrics.push(metric);
		
		outputMetrics(metrics)
    });

	
    if (request.method == 'POST') {
        req.write(requestParameters);
    }
	
    req.end();
}


//################### OUTPUT METRICS ###########################

/*
* Send metrics to console
* Receive: metrics list to output
*/
function outputMetrics(metrics)
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


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidStatusCodeError()
{
	this.name = "InvalidStatusCodeError";
	this.message = ("Invalid values in status code.");
	this.code = 23;
}
InvalidStatusCodeError.prototype = Object.create(Error.prototype);
InvalidStatusCodeError.prototype.constructor = InvalidStatusCodeError;


