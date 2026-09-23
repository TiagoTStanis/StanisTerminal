/* @ts-self-types="./rdp_client.d.ts" */

export class ClipboardData {
    static __wrap(ptr) {
        const obj = Object.create(ClipboardData.prototype);
        obj.__wbg_ptr = ptr;
        ClipboardDataFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClipboardDataFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clipboarddata_free(ptr, 0);
    }
    /**
     * @param {string} mime_type
     * @param {Uint8Array} binary
     */
    addBinary(mime_type, binary) {
        const ptr0 = passStringToWasm0(mime_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(binary, wasm.__wbindgen_malloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.clipboarddata_addBinary(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @param {string} mime_type
     * @param {string} text
     */
    addText(mime_type, text) {
        const ptr0 = passStringToWasm0(mime_type, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(text, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.clipboarddata_addText(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    constructor() {
        const ret = wasm.clipboarddata_create();
        this.__wbg_ptr = ret;
        ClipboardDataFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {boolean}
     */
    isEmpty() {
        const ret = wasm.clipboarddata_isEmpty(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {ClipboardItem[]}
     */
    items() {
        const ret = wasm.clipboarddata_items(this.__wbg_ptr);
        var v1 = getArrayJsValueFromWasm0(ret[0], ret[1]);
        wasm.__wbindgen_free(ret[0], ret[1] * 4, 4);
        return v1;
    }
}
if (Symbol.dispose) ClipboardData.prototype[Symbol.dispose] = ClipboardData.prototype.free;

export class ClipboardItem {
    static __wrap(ptr) {
        const obj = Object.create(ClipboardItem.prototype);
        obj.__wbg_ptr = ptr;
        ClipboardItemFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ClipboardItemFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_clipboarditem_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    mimeType() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.clipboarditem_mimeType(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {any}
     */
    value() {
        const ret = wasm.clipboarditem_value(this.__wbg_ptr);
        return ret;
    }
}
if (Symbol.dispose) ClipboardItem.prototype[Symbol.dispose] = ClipboardItem.prototype.free;

export class DesktopSize {
    static __wrap(ptr) {
        const obj = Object.create(DesktopSize.prototype);
        obj.__wbg_ptr = ptr;
        DesktopSizeFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DesktopSizeFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_desktopsize_free(ptr, 0);
    }
    /**
     * @param {number} width
     * @param {number} height
     */
    constructor(width, height) {
        const ret = wasm.desktopsize_create(width, height);
        this.__wbg_ptr = ret;
        DesktopSizeFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @returns {number}
     */
    get height() {
        const ret = wasm.__wbg_get_desktopsize_height(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get width() {
        const ret = wasm.__wbg_get_desktopsize_width(this.__wbg_ptr);
        return ret;
    }
    /**
     * @param {number} arg0
     */
    set height(arg0) {
        wasm.__wbg_set_desktopsize_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set width(arg0) {
        wasm.__wbg_set_desktopsize_width(this.__wbg_ptr, arg0);
    }
}
if (Symbol.dispose) DesktopSize.prototype[Symbol.dispose] = DesktopSize.prototype.free;

export class DeviceEvent {
    static __wrap(ptr) {
        const obj = Object.create(DeviceEvent.prototype);
        obj.__wbg_ptr = ptr;
        DeviceEventFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        DeviceEventFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_deviceevent_free(ptr, 0);
    }
    /**
     * @param {number} scancode
     * @returns {DeviceEvent}
     */
    static keyPressed(scancode) {
        const ret = wasm.deviceevent_keyPressed(scancode);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {number} scancode
     * @returns {DeviceEvent}
     */
    static keyReleased(scancode) {
        const ret = wasm.deviceevent_keyReleased(scancode);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {number} button
     * @returns {DeviceEvent}
     */
    static mouseButtonPressed(button) {
        const ret = wasm.deviceevent_mouseButtonPressed(button);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {number} button
     * @returns {DeviceEvent}
     */
    static mouseButtonReleased(button) {
        const ret = wasm.deviceevent_mouseButtonReleased(button);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {number} x
     * @param {number} y
     * @returns {DeviceEvent}
     */
    static mouseMove(x, y) {
        const ret = wasm.deviceevent_mouseMove(x, y);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {string} unicode
     * @returns {DeviceEvent}
     */
    static unicodePressed(unicode) {
        const char0 = unicode.codePointAt(0);
        _assertChar(char0);
        const ret = wasm.deviceevent_unicodePressed(char0);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {string} unicode
     * @returns {DeviceEvent}
     */
    static unicodeReleased(unicode) {
        const char0 = unicode.codePointAt(0);
        _assertChar(char0);
        const ret = wasm.deviceevent_unicodeReleased(char0);
        return DeviceEvent.__wrap(ret);
    }
    /**
     * @param {boolean} vertical
     * @param {number} rotation_amount
     * @param {RotationUnit} rotation_unit
     * @returns {DeviceEvent}
     */
    static wheelRotations(vertical, rotation_amount, rotation_unit) {
        const ret = wasm.deviceevent_wheelRotations(vertical, rotation_amount, rotation_unit);
        return DeviceEvent.__wrap(ret);
    }
}
if (Symbol.dispose) DeviceEvent.prototype[Symbol.dispose] = DeviceEvent.prototype.free;

export class Extension {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        ExtensionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_extension_free(ptr, 0);
    }
    /**
     * @param {string} ident
     * @param {any} value
     */
    constructor(ident, value) {
        const ptr0 = passStringToWasm0(ident, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.extension_create(ptr0, len0, value);
        this.__wbg_ptr = ret;
        ExtensionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) Extension.prototype[Symbol.dispose] = Extension.prototype.free;

export class InputTransaction {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        InputTransactionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_inputtransaction_free(ptr, 0);
    }
    /**
     * @param {DeviceEvent} event
     */
    addEvent(event) {
        _assertClass(event, DeviceEvent);
        var ptr0 = event.__destroy_into_raw();
        wasm.inputtransaction_addEvent(this.__wbg_ptr, ptr0);
    }
    constructor() {
        const ret = wasm.inputtransaction_create();
        this.__wbg_ptr = ret;
        InputTransactionFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) InputTransaction.prototype[Symbol.dispose] = InputTransaction.prototype.free;

export class IronError {
    static __wrap(ptr) {
        const obj = Object.create(IronError.prototype);
        obj.__wbg_ptr = ptr;
        IronErrorFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        IronErrorFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_ironerror_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    backtrace() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.ironerror_backtrace(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * @returns {IronErrorKind}
     */
    kind() {
        const ret = wasm.ironerror_kind(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {RDCleanPathDetails | undefined}
     */
    rdcleanpathDetails() {
        const ret = wasm.ironerror_rdcleanpathDetails(this.__wbg_ptr);
        return ret === 0 ? undefined : RDCleanPathDetails.__wrap(ret);
    }
}
if (Symbol.dispose) IronError.prototype[Symbol.dispose] = IronError.prototype.free;

/**
 * @enum {0 | 1 | 2 | 3 | 4 | 5 | 6}
 */
export const IronErrorKind = Object.freeze({
    /**
     * Catch-all error kind
     */
    General: 0, "0": "General",
    /**
     * Incorrect password used
     */
    WrongPassword: 1, "1": "WrongPassword",
    /**
     * Unable to login to machine
     */
    LogonFailure: 2, "2": "LogonFailure",
    /**
     * Insufficient permission, server denied access
     */
    AccessDenied: 3, "3": "AccessDenied",
    /**
     * Something wrong happened when sending or receiving the RDCleanPath message
     */
    RDCleanPath: 4, "4": "RDCleanPath",
    /**
     * Couldn't connect to proxy
     */
    ProxyConnect: 5, "5": "ProxyConnect",
    /**
     * Protocol negotiation failed
     */
    NegotiationFailure: 6, "6": "NegotiationFailure",
});

/**
 * Detailed error information for RDCleanPath errors.
 *
 * When an RDCleanPath error occurs, this structure provides granular details
 * about the underlying cause, including HTTP status codes, Windows Socket errors,
 * and TLS alert codes.
 */
export class RDCleanPathDetails {
    static __wrap(ptr) {
        const obj = Object.create(RDCleanPathDetails.prototype);
        obj.__wbg_ptr = ptr;
        RDCleanPathDetailsFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RDCleanPathDetailsFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rdcleanpathdetails_free(ptr, 0);
    }
    /**
     * HTTP status code if the error originated from an HTTP response.
     *
     * Common values:
     * - 403: Forbidden (e.g., deleted VNET, insufficient permissions)
     * - 404: Not Found
     * - 500: Internal Server Error
     * - 502: Bad Gateway
     * - 503: Service Unavailable
     * @returns {number | undefined}
     */
    get httpStatusCode() {
        const ret = wasm.rdcleanpathdetails_httpStatusCode(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
     * TLS alert code if the error occurred during TLS handshake.
     *
     * Common values:
     * - 40: Handshake failure
     * - 42: Bad certificate
     * - 45: Certificate expired
     * - 48: Unknown CA
     * - 112: Unrecognized name
     * @returns {number | undefined}
     */
    get tlsAlertCode() {
        const ret = wasm.rdcleanpathdetails_tlsAlertCode(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
    /**
     * Windows Socket API (WSA) error code.
     *
     * Common values:
     * - 10013: Permission denied (WSAEACCES) - often indicates deleted/invalid VNET
     * - 10060: Connection timed out (WSAETIMEDOUT)
     * - 10061: Connection refused (WSAECONNREFUSED)
     * - 10051: Network is unreachable (WSAENETUNREACH)
     * - 10065: No route to host (WSAEHOSTUNREACH)
     * @returns {number | undefined}
     */
    get wsaErrorCode() {
        const ret = wasm.rdcleanpathdetails_wsaErrorCode(this.__wbg_ptr);
        return ret === 0xFFFFFF ? undefined : ret;
    }
}
if (Symbol.dispose) RDCleanPathDetails.prototype[Symbol.dispose] = RDCleanPathDetails.prototype.free;

export class RdpFile {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        RdpFileFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_rdpfile_free(ptr, 0);
    }
    constructor() {
        const ret = wasm.rdpfile_create();
        this.__wbg_ptr = ret;
        RdpFileFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {string} key
     * @returns {number | undefined}
     */
    getInt(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.rdpfile_getInt(this.__wbg_ptr, ptr0, len0);
        return ret === Number.MAX_SAFE_INTEGER ? undefined : ret;
    }
    /**
     * @param {string} key
     * @returns {string | undefined}
     */
    getStr(key) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.rdpfile_getStr(this.__wbg_ptr, ptr0, len0);
        let v2;
        if (ret[0] !== 0) {
            v2 = getStringFromWasm0(ret[0], ret[1]);
            wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
        }
        return v2;
    }
    /**
     * @param {string} key
     * @param {number} value
     */
    insertInt(key, value) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.rdpfile_insertInt(this.__wbg_ptr, ptr0, len0, value);
    }
    /**
     * @param {string} key
     * @param {string} value
     */
    insertStr(key, value) {
        const ptr0 = passStringToWasm0(key, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(value, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        wasm.rdpfile_insertStr(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @param {string} config
     */
    parse(config) {
        const ptr0 = passStringToWasm0(config, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.rdpfile_parse(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @returns {string}
     */
    write() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.rdpfile_write(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) RdpFile.prototype[Symbol.dispose] = RdpFile.prototype.free;

/**
 * @enum {0 | 1 | 2}
 */
export const RotationUnit = Object.freeze({
    Pixel: 0, "0": "Pixel",
    Line: 1, "1": "Line",
    Page: 2, "2": "Page",
});

export class Session {
    static __wrap(ptr) {
        const obj = Object.create(Session.prototype);
        obj.__wbg_ptr = ptr;
        SessionFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SessionFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_session_free(ptr, 0);
    }
    /**
     * @param {InputTransaction} transaction
     */
    applyInputs(transaction) {
        _assertClass(transaction, InputTransaction);
        var ptr0 = transaction.__destroy_into_raw();
        const ret = wasm.session_applyInputs(this.__wbg_ptr, ptr0);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {DesktopSize}
     */
    desktopSize() {
        const ret = wasm.session_desktopSize(this.__wbg_ptr);
        return DesktopSize.__wrap(ret);
    }
    /**
     * @param {Extension} ext
     * @returns {any}
     */
    invokeExtension(ext) {
        _assertClass(ext, Extension);
        var ptr0 = ext.__destroy_into_raw();
        const ret = wasm.session_invokeExtension(this.__wbg_ptr, ptr0);
        if (ret[2]) {
            throw takeFromExternrefTable0(ret[1]);
        }
        return takeFromExternrefTable0(ret[0]);
    }
    /**
     * @param {ClipboardData} content
     * @returns {Promise<void>}
     */
    onClipboardPaste(content) {
        _assertClass(content, ClipboardData);
        const ret = wasm.session_onClipboardPaste(this.__wbg_ptr, content.__wbg_ptr);
        return ret;
    }
    releaseAllInputs() {
        const ret = wasm.session_releaseAllInputs(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {number | null} [scale_factor]
     * @param {number | null} [physical_width]
     * @param {number | null} [physical_height]
     */
    resize(width, height, scale_factor, physical_width, physical_height) {
        wasm.session_resize(this.__wbg_ptr, width, height, isLikeNone(scale_factor) ? Number.MAX_SAFE_INTEGER : (scale_factor) >>> 0, isLikeNone(physical_width) ? Number.MAX_SAFE_INTEGER : (physical_width) >>> 0, isLikeNone(physical_height) ? Number.MAX_SAFE_INTEGER : (physical_height) >>> 0);
    }
    /**
     * @returns {Promise<SessionTerminationInfo>}
     */
    run() {
        const ret = wasm.session_run(this.__wbg_ptr);
        return ret;
    }
    shutdown() {
        const ret = wasm.session_shutdown(this.__wbg_ptr);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
    /**
     * @returns {boolean}
     */
    supportsUnicodeKeyboardShortcuts() {
        const ret = wasm.session_supportsUnicodeKeyboardShortcuts(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {boolean} scroll_lock
     * @param {boolean} num_lock
     * @param {boolean} caps_lock
     * @param {boolean} kana_lock
     */
    synchronizeLockKeys(scroll_lock, num_lock, caps_lock, kana_lock) {
        const ret = wasm.session_synchronizeLockKeys(this.__wbg_ptr, scroll_lock, num_lock, caps_lock, kana_lock);
        if (ret[1]) {
            throw takeFromExternrefTable0(ret[0]);
        }
    }
}
if (Symbol.dispose) Session.prototype[Symbol.dispose] = Session.prototype.free;

export class SessionBuilder {
    static __wrap(ptr) {
        const obj = Object.create(SessionBuilder.prototype);
        obj.__wbg_ptr = ptr;
        SessionBuilderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SessionBuilderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sessionbuilder_free(ptr, 0);
    }
    /**
     * @param {string} token
     * @returns {SessionBuilder}
     */
    authToken(token) {
        const ptr0 = passStringToWasm0(token, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_authToken(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {Function} callback
     * @returns {SessionBuilder}
     */
    canvasResizedCallback(callback) {
        const ret = wasm.sessionbuilder_canvasResizedCallback(this.__wbg_ptr, callback);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @returns {Promise<Session>}
     */
    connect() {
        const ret = wasm.sessionbuilder_connect(this.__wbg_ptr);
        return ret;
    }
    constructor() {
        const ret = wasm.sessionbuilder_create();
        this.__wbg_ptr = ret;
        SessionBuilderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {DesktopSize} desktop_size
     * @returns {SessionBuilder}
     */
    desktopSize(desktop_size) {
        _assertClass(desktop_size, DesktopSize);
        var ptr0 = desktop_size.__destroy_into_raw();
        const ret = wasm.sessionbuilder_desktopSize(this.__wbg_ptr, ptr0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {string} destination
     * @returns {SessionBuilder}
     */
    destination(destination) {
        const ptr0 = passStringToWasm0(destination, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_destination(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {Extension} ext
     * @returns {SessionBuilder}
     */
    extension(ext) {
        _assertClass(ext, Extension);
        var ptr0 = ext.__destroy_into_raw();
        const ret = wasm.sessionbuilder_extension(this.__wbg_ptr, ptr0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {Function} callback
     * @returns {SessionBuilder}
     */
    forceClipboardUpdateCallback(callback) {
        const ret = wasm.sessionbuilder_forceClipboardUpdateCallback(this.__wbg_ptr, callback);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {string} password
     * @returns {SessionBuilder}
     */
    password(password) {
        const ptr0 = passStringToWasm0(password, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_password(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {string} address
     * @returns {SessionBuilder}
     */
    proxyAddress(address) {
        const ptr0 = passStringToWasm0(address, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_proxyAddress(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {Function} callback
     * @returns {SessionBuilder}
     */
    remoteClipboardChangedCallback(callback) {
        const ret = wasm.sessionbuilder_remoteClipboardChangedCallback(this.__wbg_ptr, callback);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {HTMLCanvasElement} canvas
     * @returns {SessionBuilder}
     */
    renderCanvas(canvas) {
        const ret = wasm.sessionbuilder_renderCanvas(this.__wbg_ptr, canvas);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {string} server_domain
     * @returns {SessionBuilder}
     */
    serverDomain(server_domain) {
        const ptr0 = passStringToWasm0(server_domain, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_serverDomain(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {any} context
     * @returns {SessionBuilder}
     */
    setCursorStyleCallbackContext(context) {
        const ret = wasm.sessionbuilder_setCursorStyleCallbackContext(this.__wbg_ptr, context);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {Function} callback
     * @returns {SessionBuilder}
     */
    setCursorStyleCallback(callback) {
        const ret = wasm.sessionbuilder_setCursorStyleCallback(this.__wbg_ptr, callback);
        return SessionBuilder.__wrap(ret);
    }
    /**
     * @param {string} username
     * @returns {SessionBuilder}
     */
    username(username) {
        const ptr0 = passStringToWasm0(username, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.sessionbuilder_username(this.__wbg_ptr, ptr0, len0);
        return SessionBuilder.__wrap(ret);
    }
}
if (Symbol.dispose) SessionBuilder.prototype[Symbol.dispose] = SessionBuilder.prototype.free;

export class SessionTerminationInfo {
    static __wrap(ptr) {
        const obj = Object.create(SessionTerminationInfo.prototype);
        obj.__wbg_ptr = ptr;
        SessionTerminationInfoFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SessionTerminationInfoFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_sessionterminationinfo_free(ptr, 0);
    }
    /**
     * @returns {string}
     */
    reason() {
        let deferred1_0;
        let deferred1_1;
        try {
            const ret = wasm.sessionterminationinfo_reason(this.__wbg_ptr);
            deferred1_0 = ret[0];
            deferred1_1 = ret[1];
            return getStringFromWasm0(ret[0], ret[1]);
        } finally {
            wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
        }
    }
}
if (Symbol.dispose) SessionTerminationInfo.prototype[Symbol.dispose] = SessionTerminationInfo.prototype.free;

/**
 * @param {string} log_level
 */
export function setup(log_level) {
    const ptr0 = passStringToWasm0(log_level, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    wasm.setup(ptr0, len0);
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_boolean_get_7a12af2b3f899c5a: function(arg0) {
            const v = arg0;
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_0e68cf47c9cbd9b0: function(arg0, arg1) {
            const ret = debugString(arg1);
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_function_fcda5e3902d732fe: function(arg0) {
            const ret = typeof(arg0) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_5160b3e381865372: function(arg0) {
            const ret = arg0 === null;
            return ret;
        },
        __wbg___wbindgen_is_string_c4f7cb494a2a21f1: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_is_undefined_8c687d0b90d5b524: function(arg0) {
            const ret = arg0 === undefined;
            return ret;
        },
        __wbg___wbindgen_number_get_1dc732b810cb937c: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_92ab86bb19cbc12f: function(arg0, arg1) {
            const obj = arg1;
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_997e73d32238e655: function(arg0) {
            arg0._wbg_cb_unref();
        },
        __wbg_addEventListener_2f29f3aa43f18e91: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3, arg4);
        }, arguments); },
        __wbg_addEventListener_9534e2dc12044ee4: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.addEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_apply_5d9aa7604c2490a8: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.apply(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_arrayBuffer_06f3da76f071d37f: function() { return handleError(function (arg0) {
            const ret = arg0.arrayBuffer();
            return ret;
        }, arguments); },
        __wbg_call_269c5566fbede3eb: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.call(arg1);
            return ret;
        }, arguments); },
        __wbg_call_6bcf8d3e20937e46: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.call(arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_call_7bbd9cceba9949ad: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = arg0.call(arg1, arg2, arg3);
            return ret;
        }, arguments); },
        __wbg_clearInterval_26ba580547547579: function(arg0) {
            const ret = clearInterval(arg0);
            return ret;
        },
        __wbg_clearTimeout_3629d6209dfcc46e: function(arg0) {
            const ret = clearTimeout(arg0);
            return ret;
        },
        __wbg_clipboarddata_new: function(arg0) {
            const ret = ClipboardData.__wrap(arg0);
            return ret;
        },
        __wbg_clipboarditem_new: function(arg0) {
            const ret = ClipboardItem.__wrap(arg0);
            return ret;
        },
        __wbg_close_a009f540ff811039: function() { return handleError(function (arg0) {
            arg0.close();
        }, arguments); },
        __wbg_code_6bc89190cbffee9e: function(arg0) {
            const ret = arg0.code;
            return ret;
        },
        __wbg_data_aa7ba49b34c0d883: function(arg0) {
            const ret = arg0.data;
            return ret;
        },
        __wbg_debug_eb092a10b3338acb: function(arg0) {
            console.debug(arg0);
        },
        __wbg_dispatchEvent_67aab71ae1deb26a: function() { return handleError(function (arg0, arg1) {
            const ret = arg0.dispatchEvent(arg1);
            return ret;
        }, arguments); },
        __wbg_error_756c5934221e6fee: function(arg0) {
            console.error(arg0);
        },
        __wbg_error_757e9472f8410341: function(arg0, arg1) {
            let deferred0_0;
            let deferred0_1;
            try {
                deferred0_0 = arg0;
                deferred0_1 = arg1;
                console.error(getStringFromWasm0(arg0, arg1));
            } finally {
                wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
            }
        },
        __wbg_fetch_9b478faef8cda538: function(arg0) {
            const ret = fetch(arg0);
            return ret;
        },
        __wbg_from_a39669ce566077da: function(arg0) {
            const ret = Array.from(arg0);
            return ret;
        },
        __wbg_getContext_e0c05ffee530bdcf: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = arg0.getContext(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        }, arguments); },
        __wbg_getRandomValues_436a51d0629d84e1: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getRandomValues_a608c4436c19407a: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getRandomValues_a678b7300e8ed57f: function() { return handleError(function (arg0, arg1) {
            globalThis.crypto.getRandomValues(getArrayU8FromWasm0(arg0, arg1));
        }, arguments); },
        __wbg_getTime_65922ba0b59d55a7: function(arg0) {
            const ret = arg0.getTime();
            return ret;
        },
        __wbg_get_989d0a1309644f2b: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_get_b1f0ab13c737f856: function(arg0, arg1) {
            const ret = arg0[arg1 >>> 0];
            return ret;
        },
        __wbg_height_c15ee46a1345e9af: function(arg0) {
            const ret = arg0.height;
            return ret;
        },
        __wbg_info_f25c01bee103395d: function(arg0) {
            console.info(arg0);
        },
        __wbg_instanceof_ArrayBuffer_d4ff01f8247925ae: function(arg0) {
            let result;
            try {
                result = arg0 instanceof ArrayBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_CanvasRenderingContext2d_bde5245b14027f3f: function(arg0) {
            let result;
            try {
                result = arg0 instanceof CanvasRenderingContext2D;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Error_fe6fa771c78ee4cf: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Error;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Object_87732cb922ac2e2c: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Object;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Response_6366a785e400039b: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Response;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_Window_a3b8566f0a9c5d1a: function(arg0) {
            let result;
            try {
                result = arg0 instanceof Window;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_ironerror_new: function(arg0) {
            const ret = IronError.__wrap(arg0);
            return ret;
        },
        __wbg_length_31bdaf014f5fbde2: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_length_4e1adc0d42e23620: function(arg0) {
            const ret = arg0.length;
            return ret;
        },
        __wbg_message_1cbc5bc03dcf1dee: function(arg0) {
            const ret = arg0.message;
            return ret;
        },
        __wbg_name_b9d8f2ea16b22045: function(arg0) {
            const ret = arg0.name;
            return ret;
        },
        __wbg_navigator_d217ca64c4bbff48: function(arg0) {
            const ret = arg0.navigator;
            return ret;
        },
        __wbg_new_0_35540e542ba689d2: function() {
            const ret = new Date();
            return ret;
        },
        __wbg_new_0afe64b4dc16ab74: function() { return handleError(function () {
            const ret = new Headers();
            return ret;
        }, arguments); },
        __wbg_new_1da3429bc3c4541c: function(arg0) {
            const ret = new Uint8Array(arg0);
            return ret;
        },
        __wbg_new_227d7c05414eb861: function() {
            const ret = new Error();
            return ret;
        },
        __wbg_new_2fa8dd8f40f14923: function() { return handleError(function (arg0, arg1) {
            const ret = new URL(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_new_82926b2a4d30e175: function() { return handleError(function (arg0, arg1) {
            const ret = new WebSocket(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_new_bebc3f4757acf305: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_new_e60365bfd84fce6d: function() { return handleError(function () {
            const ret = new URLSearchParams();
            return ret;
        }, arguments); },
        __wbg_new_ffa92086ea89f79c: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_from_slice_4ee02165f9de919e: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_from_slice_a500ec81601be48f: function(arg0, arg1) {
            const ret = new Uint32Array(getArrayU32FromWasm0(arg0, arg1));
            return ret;
        },
        __wbg_new_typed_6f8b0d724fe26c07: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined_______true_(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return ret;
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_event_init_dict_30af3c2d6e059c3a: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = new CloseEvent(getStringFromWasm0(arg0, arg1), arg2);
            return ret;
        }, arguments); },
        __wbg_new_with_str_3827d1a2319e0426: function() { return handleError(function (arg0, arg1) {
            const ret = new Request(getStringFromWasm0(arg0, arg1));
            return ret;
        }, arguments); },
        __wbg_new_with_str_and_init_2f31a77deda127fd: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = new Request(getStringFromWasm0(arg0, arg1), arg2);
            return ret;
        }, arguments); },
        __wbg_new_with_u8_array_sequence_d189f1c530aae28a: function() { return handleError(function (arg0) {
            const ret = new Blob(arg0);
            return ret;
        }, arguments); },
        __wbg_new_with_u8_clamped_array_and_sh_15a008af56aca047: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = new ImageData(getClampedArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
            return ret;
        }, arguments); },
        __wbg_now_0b7736bc17fd7719: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_now_d1fb6650485d7f3e: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_now_e7c6795a7f81e10f: function(arg0) {
            const ret = arg0.now();
            return ret;
        },
        __wbg_of_1a3f47170341cefe: function(arg0) {
            const ret = Array.of(arg0);
            return ret;
        },
        __wbg_ok_0d8e8fee3573b7ce: function(arg0) {
            const ret = arg0.ok;
            return ret;
        },
        __wbg_performance_3fcf6e32a7e1ed0a: function(arg0) {
            const ret = arg0.performance;
            return ret;
        },
        __wbg_performance_d96ad0b441f4510a: function(arg0) {
            const ret = arg0.performance;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_prototypesetcall_ae9f5e7459250748: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), arg2);
        },
        __wbg_push_bfdf956ba476f65b: function(arg0, arg1) {
            const ret = arg0.push(arg1);
            return ret;
        },
        __wbg_putImageData_581de52c9f40fc59: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.putImageData(arg1, arg2, arg3);
        }, arguments); },
        __wbg_queueMicrotask_85c90f6987555d65: function(arg0) {
            const ret = arg0.queueMicrotask;
            return ret;
        },
        __wbg_queueMicrotask_f6a1fa10b81d1fc0: function(arg0) {
            queueMicrotask(arg0);
        },
        __wbg_readyState_83df235b27cf257f: function(arg0) {
            const ret = arg0.readyState;
            return ret;
        },
        __wbg_reason_9b593bf440970929: function(arg0, arg1) {
            const ret = arg1.reason;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_removeEventListener_4c9706814dcfaf79: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            arg0.removeEventListener(getStringFromWasm0(arg1, arg2), arg3);
        }, arguments); },
        __wbg_resolve_35ec7e0c6af4c82c: function(arg0) {
            const ret = Promise.resolve(arg0);
            return ret;
        },
        __wbg_search_6b8de53571c80faa: function(arg0, arg1) {
            const ret = arg1.search;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_send_158869afaf63f5d7: function() { return handleError(function (arg0, arg1) {
            arg0.send(arg1);
        }, arguments); },
        __wbg_send_2bc0d66d884817ad: function() { return handleError(function (arg0, arg1, arg2) {
            arg0.send(getStringFromWasm0(arg1, arg2));
        }, arguments); },
        __wbg_session_new: function(arg0) {
            const ret = Session.__wrap(arg0);
            return ret;
        },
        __wbg_sessionterminationinfo_new: function(arg0) {
            const ret = SessionTerminationInfo.__wrap(arg0);
            return ret;
        },
        __wbg_setInterval_cbf1c35c6a692d37: function() { return handleError(function (arg0, arg1) {
            const ret = setInterval(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_setTimeout_56bcdccbad22fd44: function() { return handleError(function (arg0, arg1) {
            const ret = setTimeout(arg0, arg1);
            return ret;
        }, arguments); },
        __wbg_set_7923e5ea63b41e6b: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            arg0.set(getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
        }, arguments); },
        __wbg_set_a377297433dfea63: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(arg0, arg1, arg2);
            return ret;
        }, arguments); },
        __wbg_set_binaryType_f88804219cea0f9e: function(arg0, arg1) {
            arg0.binaryType = __wbindgen_enum_BinaryType[arg1];
        },
        __wbg_set_body_f39cee72c74a5b02: function(arg0, arg1) {
            arg0.body = arg1;
        },
        __wbg_set_code_15e44128974cf61c: function(arg0, arg1) {
            arg0.code = arg1;
        },
        __wbg_set_headers_31d373f68f28bf76: function(arg0, arg1) {
            arg0.headers = arg1;
        },
        __wbg_set_height_698fb3b255bc1348: function(arg0, arg1) {
            arg0.height = arg1 >>> 0;
        },
        __wbg_set_method_82e6c3c083da0734: function(arg0, arg1, arg2) {
            arg0.method = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_once_60a969fcdc22b373: function(arg0, arg1) {
            arg0.once = arg1 !== 0;
        },
        __wbg_set_reason_e2d5b642ee480ff4: function(arg0, arg1, arg2) {
            arg0.reason = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_search_4282ef5d8c36f833: function(arg0, arg1, arg2) {
            arg0.search = getStringFromWasm0(arg1, arg2);
        },
        __wbg_set_width_4c3a2252e0dea033: function(arg0, arg1) {
            arg0.width = arg1 >>> 0;
        },
        __wbg_stack_3b0d974bbf31e44f: function(arg0, arg1) {
            const ret = arg1.stack;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_static_accessor_GLOBAL_8eb4cd83130a11a0: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_1e7044f654e934db: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_SELF_d8b50611246a6d92: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_static_accessor_WINDOW_fd0bc376bf0f8b42: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addToExternrefTable0(ret);
        },
        __wbg_statusText_d25b9b3ccc0d4617: function(arg0, arg1) {
            const ret = arg1.statusText;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_status_88ccc72fe7bea621: function(arg0) {
            const ret = arg0.status;
            return ret;
        },
        __wbg_then_7a850dae4493f353: function(arg0, arg1, arg2) {
            const ret = arg0.then(arg1, arg2);
            return ret;
        },
        __wbg_then_b830475380919203: function(arg0, arg1) {
            const ret = arg0.then(arg1);
            return ret;
        },
        __wbg_toString_794a30e85c994f2a: function(arg0) {
            const ret = arg0.toString();
            return ret;
        },
        __wbg_toString_beee8ad71195e063: function(arg0) {
            const ret = arg0.toString();
            return ret;
        },
        __wbg_url_8d180a4a6996e22d: function(arg0, arg1) {
            const ret = arg1.url;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg_userAgent_8f029431f94bc023: function() { return handleError(function (arg0, arg1) {
            const ret = arg1.userAgent;
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        }, arguments); },
        __wbg_warn_d3544c7814fab534: function(arg0) {
            console.warn(arg0);
        },
        __wbg_wasClean_a32ef5f1fd90161e: function(arg0) {
            const ret = arg0.wasClean;
            return ret;
        },
        __wbg_width_b5e609025d3f7451: function(arg0) {
            const ret = arg0.width;
            return ret;
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 114, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___wasm_bindgen_6b48050b2f88e23f___JsValue__core_ed718c3d60ebd546___result__Result_____wasm_bindgen_6b48050b2f88e23f___JsError___true_);
            return ret;
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("CloseEvent")], shim_idx: 190, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true_);
            return ret;
        },
        __wbindgen_generic_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("Event")], shim_idx: 190, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__67);
            return ret;
        },
        __wbindgen_generic_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [NamedExternref("MessageEvent")], shim_idx: 190, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__68);
            return ret;
        },
        __wbindgen_generic_0000000000000005: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [], shim_idx: 194, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true_);
            return ret;
        },
        __wbindgen_generic_0000000000000006: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [], shim_idx: 3706, ret: Unit, inner_ret: Some(Unit) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true__1_);
            return ret;
        },
        __wbindgen_generic_0000000000000007: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_generic_0000000000000008: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./rdp_client_bg.js": import0,
    };
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true_(arg0, arg1) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true_(arg0, arg1);
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true__1_(arg0, arg1) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke_______true__1_(arg0, arg1);
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true_(arg0, arg1, arg2) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true_(arg0, arg1, arg2);
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__67(arg0, arg1, arg2) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__67(arg0, arg1, arg2);
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__68(arg0, arg1, arg2) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___web_sys_275cf218f3d1a9e9___features__gen_CloseEvent__CloseEvent______true__68(arg0, arg1, arg2);
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___wasm_bindgen_6b48050b2f88e23f___JsValue__core_ed718c3d60ebd546___result__Result_____wasm_bindgen_6b48050b2f88e23f___JsError___true_(arg0, arg1, arg2) {
    const ret = wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___wasm_bindgen_6b48050b2f88e23f___JsValue__core_ed718c3d60ebd546___result__Result_____wasm_bindgen_6b48050b2f88e23f___JsError___true_(arg0, arg1, arg2);
    if (ret[1]) {
        throw takeFromExternrefTable0(ret[0]);
    }
}

function wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined_______true_(arg0, arg1, arg2, arg3) {
    wasm.wasm_bindgen_6b48050b2f88e23f___convert__closures_____invoke___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined___js_sys_35121ca2afa5bc29___Function_fn_wasm_bindgen_6b48050b2f88e23f___JsValue_____wasm_bindgen_6b48050b2f88e23f___sys__Undefined_______true_(arg0, arg1, arg2, arg3);
}


const __wbindgen_enum_BinaryType = ["blob", "arraybuffer"];
const ClipboardDataFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clipboarddata_free(ptr, 1));
const ClipboardItemFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_clipboarditem_free(ptr, 1));
const DesktopSizeFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_desktopsize_free(ptr, 1));
const DeviceEventFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_deviceevent_free(ptr, 1));
const ExtensionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_extension_free(ptr, 1));
const InputTransactionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_inputtransaction_free(ptr, 1));
const IronErrorFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_ironerror_free(ptr, 1));
const RDCleanPathDetailsFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rdcleanpathdetails_free(ptr, 1));
const RdpFileFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_rdpfile_free(ptr, 1));
const SessionFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_session_free(ptr, 1));
const SessionBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sessionbuilder_free(ptr, 1));
const SessionTerminationInfoFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_sessionterminationinfo_free(ptr, 1));

function addToExternrefTable0(obj) {
    const idx = wasm.__externref_table_alloc();
    wasm.__wbindgen_externrefs.set(idx, obj);
    return idx;
}

function _assertChar(c) {
    if (typeof(c) === 'number' && (c >= 0x110000 || (c >= 0xD800 && c < 0xE000))) throw new Error(`expected a valid Unicode scalar value, found ${c}`);
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_destroy_closure(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(wasm.__wbindgen_externrefs.get(mem.getUint32(i, true)));
    }
    wasm.__externref_drop_slice(ptr, len);
    return result;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

function getClampedArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ClampedArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

let cachedUint8ClampedArrayMemory0 = null;
function getUint8ClampedArrayMemory0() {
    if (cachedUint8ClampedArrayMemory0 === null || cachedUint8ClampedArrayMemory0.byteLength === 0) {
        cachedUint8ClampedArrayMemory0 = new Uint8ClampedArray(wasm.memory.buffer);
    }
    return cachedUint8ClampedArrayMemory0;
}

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        const idx = addToExternrefTable0(e);
        wasm.__wbindgen_exn_store(idx);
    }
}

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_destroy_closure(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    cachedUint8ClampedArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('rdp_client_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
