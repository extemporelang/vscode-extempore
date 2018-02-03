// 
// sexpr helper code
//


/////////////////////////////////////////////////////
//
// Extempore BLOCK delimiters
// where a block is supposed to be delimited by a top-level "\n(define..." or "\n(bind..." 
// 
// note that block delimiters do not need to be (or be expected to be) exhaustive.
// they just provide some reasonable level of delineation when parsing large files
//

// not using a regex is *considerably* faster here but no spaces allowed :(
let findOpenBlock = (str: string, pos: number): number => {
    let a = str.lastIndexOf("\n(define", pos);
    let b = str.lastIndexOf("\n(bind", pos);
    if (a === -1) a = b;
    return (a > b) ? a : b;
}

let findCloseBlock = (str: string, pos: number): number => {
    let a = str.indexOf("\n(define", pos);
    let b = str.indexOf("\n(bind", pos);
    if (a === -1) a = b;
    return (a < b) ? a : b;
}

/*
///////////////// REGEX VERSION OF findOpenBlock/findCloseBlock
const regexIndexOf = function (str, regex, startpos) {
    var indexOf = str.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

const regexLastIndexOf = function(str, regex, startpos) {
    regex = (regex.global) ? regex : new RegExp(regex.source, "g" + (regex.ignoreCase ? "i" : "") + (regex.multiLine ? "m" : ""));
    if(typeof (startpos) == "undefined") {
        startpos = str.length;
    } else if(startpos < 0) {
        startpos = 0;
    }
    var stringToWorkWith = str.substring(0, startpos + 1);
    var lastIndexOf = -1;
    var nextStop = 0;
    var result;
    while((result = regex.exec(stringToWorkWith)) != null) {
        lastIndexOf = result.index;
        regex.lastIndex = ++nextStop;
    }
    return lastIndexOf;
}

let findOpenBlock = (str: string, pos: number): number => regexLastIndexOf(str, /\n\s*?\((define|bind)/m, pos);
let findCloseBlock = (str: string, pos: number): number => regexIndexOf(str, /\n\s*?\((define|bind)/m, pos);
*/



///////////////////////////////////// block delimeters


///////////////////////////////////////////////////////////////////////
//
// PAREN MATCHING
// which requies that comment and string strip have alread
// been taken care of
//

// findOpenParen (or backward matching paren)
let findOpenParen = (str: string, pos: number): number => {
    let stack = 0;
    let char = '';
    let n = pos;
    if (str[n] === ')') n--; // if pos on ')' move inside expr!
    while (true) {
        char = str[n];
        if (char === ')') stack++;
        if (char === '(') {
            if (stack > 0) stack--;
            else break;
        }
        n--;
        if (n < 0) {
            n = -1;
            break;
        }
    }
    return n;
}

// findCloseParen (or forward matching paren)
let findCloseParen = (str: string, pos: number): number => {
    let stack = 0;
    let char = '';
    let n = pos;
    if (str[n] === '(') n++; // if pos on '(' move inside expr!
    while (true) {
        char = str[n];
        if (char === '(') stack++;
        if (char === ')') {
            if (stack > 0) stack--;
            else break;
        }
        n++;
        if (n === str.length) {
            n = -1;
            break;
        }
    }
    return n;
}

//////////////////////////////////////////////////////////
//
// strip comments and strings from expr
//
// replace all comments in string with _______
let stripComments = (str: string): string => {
    let newstr = JSON.parse(JSON.stringify(str)); // rediculous copy???
    let matches = newstr.match(/(;.*)$/mg);
    if (matches) {
        for (var i = 0; i < matches.length; i++) {
            let repstr = '_'.repeat(matches[i].length);
            newstr = newstr.replace(matches[i], repstr);
        }
    }
    return newstr;
}

// replace all strings in str with ___________
let stripStrings = (str: string): string => {
    let newstr = JSON.parse(JSON.stringify(str)); // rediculous copy???
    // this line because I'm having trouble figuring out the "" case for 
    // the following regex (that doesn't break other cases!)
    newstr = newstr.replace(new RegExp(/""/, 'g'), "__");
    // be careful to account for escaped quotes "\"".   
    let matches = newstr.match(/("[\s\S]*?([^\\]"))/mg);
    if (matches) {
        for (var i = 0; i < matches.length; i++) {
            let replacement = matches[i].replace(/./g, "_");
            newstr = newstr.replace(matches[i],replacement);
        }
    }
    return newstr;
}

/////////////////////////////////////////////////////

// returns a redacted 'stripped' xtm block 
// delimited before and after by a top level "\n(define" or "\n(bind"
export let xtmGetBlock = (str: string, pos: number, rlimit: number = 20000): [number, number, string] => {
    let open = findOpenBlock(str, pos);
    let close = findCloseBlock(str, pos);
    if (open < 0) open = 0;
    if (close < 0) close = str.length;
    let newstr = str.substring(open, close);
    newstr = stripStrings(newstr); // strings should be stripped before comments!!
    newstr = stripComments(newstr);
    return [open, close, newstr];
}

// find extent of the expr that pos falls inside. 
let inSexpr = (str: string, pos: number): [number, number] => {
    let np = pos;
    let open = findOpenParen(str, pos);
    let close = findCloseParen(str, open);
    //console.log(`insexpr ${np} ${open}:${close}`);
    //console.log(`insexpr ${np} ${open}:${close} - ${str.substring((open < 0) ? 0 : open, (close<0) ? str.length : close)}`);
    return [open, close];
}

// expand sexpr to maximum extent (i.e. top-level)
let expandSexpr = (strin: string, sexpr: [number,number]): [number,number] => {
    if (sexpr[0] < 1) return sexpr; // can't be any further expansion
    let newsexpr = inSexpr(strin, sexpr[0] - 1);
    if (newsexpr[0] > -1 && newsexpr[1] > -1) {
        return expandSexpr(strin, newsexpr);
    } else {
        return sexpr;
    }
}

let sexprName = (str: string, sexpr: [number,number]): string => {
    if (sexpr[0] < 0) return "";
    let exprcontents = str.substring(sexpr[0] + 1, (sexpr[1] < 0) ? str.length : sexpr[1]);
    let name = exprcontents.match("^\\S*");
    return name[0];
}

export let xtmTopLevelSexpr = (strin: string, pos: number): [number,number] => {
    let s = inSexpr(strin, pos);
    let s_expanded = expandSexpr(strin, s);
    while (!(s[0] === s_expanded[0] && s[1] === s_expanded[1])) {
        s = s_expanded;
        s_expanded = expandSexpr(strin, s_expanded);
    }
    return s_expanded;
}

// get whitespace count from the start of the 'line' that the sexpr starts on
// note that this is whitespace amount from the *start* of line
// (i.e. the sexpr start may not be the first sexpr to start on that line)
// let lineIndentAmount = (strin: string, sexpr: [number,number]): number => {
//     let lineStart = strin.lastIndexOf("\n", sexpr[0]);
//     let lineEnd = strin.indexOf("\n", sexpr[0]);
//     let lineStr = strin.substring(lineStart, lineEnd);
//     let match = lineStr.match("^\\s*"); // indent on FIRST LINE
//     let indent = (match.length) ? match[0].length - 1 : 0;
//     return indent;
// }

let sexprArgPos = (strin: string, sexpr: [number,number]): number => {
    let lineStart = strin.lastIndexOf("\n", sexpr[0]);
    let lineEnd = strin.indexOf("\n", sexpr[0]);
    let lineStr = strin.substring(lineStart, lineEnd);
    let name = sexprName(strin, sexpr);
    //console.log("myname: " + name);
    let indent = lineStr.indexOf(name) + name.length;
    if (name.match("^[`',@#(]")) indent = indent - (name.length + 1);
    //if (name.startsWith("(")) indent = indent - (name.length + 1);
    //if (name.startsWith("#(")) indent = indent - (name.length + 1);
    return indent;
}

let NamedIndentsShort = ["let", "define", "lambda", "bind-func", "letz", "begin", ":>", ":|"];

// indent amount
let sexprIndent = (strin: string, sexpr: [number, number]): number => {
    if (sexpr[0] === -1 || sexpr[1] !== -1) return 0; //indent;
    let name = sexprName(strin, sexpr);
    let shortIndent = (NamedIndentsShort.indexOf(name) > -1) ? true : false;
    //let indent = lineIndentAmount(strin, sexpr);
    let lineStart = strin.lastIndexOf("\n", sexpr[0]);
    let indent = sexpr[0] - ((lineStart > 0) ? lineStart : 0);
    if (shortIndent) return indent + 1;
    return sexprArgPos(strin,sexpr);
}

export let xtmIndent = (strin: string): number => {
    let sexpr = inSexpr(strin, strin.length - 1);
    let indent = sexprIndent(strin, sexpr);
    let name = sexprName(strin, sexpr);
    return indent;
}