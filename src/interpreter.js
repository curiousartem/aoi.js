const Discord = require("discord.js");
const { CustomFunction } = require("./classes/Functions.js");
const AoiError = require("./classes/AoiError.js");
const Util = require("./classes/Util.js");

const IF = require("./utils/helpers/if.js");

const PATH = require("path");

async function Interpreter(
    client,
    message,
    args,
    command,
    _db,
    returnCode = false,
    channelUsed,
    data = {},
    useChannel,
    returnMessage,
    returnExecution,
    returnID,
    sendMessage = false
) {
    try {
        let code = command.code
            ?.replaceAll("\\]", "#LEFT#")
            .split("\\[")
            .join("#RIGHT#")
            .replaceAll("\\,", "#COMMA#")
            .replaceAll("\\;", "#SEMI#");

        let [
            randoms,
            timezone,
            letVars,
            object,
            disableMentions,
            array,
            arrays,
            reactions,
            channel,
            author,
            guild,
            mentions,
            member,
            msg,
        ] = [
            data.randoms || {},
            "UTC",
            data.vars || {},
            data.object || {},
            ["roles", "users", "everyone"],
            data.array || [],
            data.arrays || [],
            [],
            message.channel,
            message.author,
            message.guild,
            message.mentions,
            message.member,
            message,
        ];

        let errorOccurred;
        let embeds;
        let files = [];
        let suppressErrors;
        let editIn = undefined;
        let error;
        let attachments = [];
        let components = [];
        let reply;
        let allowedMentions = disableMentions;
        let FuncData;
        let msgobj;
        let funcLine;
        let returnData = {};
        command.codeLines =
            command.codeLines ||
            client.functionManager.serializeCode(command.code);

        let funcs = command.functions?.length
            ? command.functions
            : client.functionManager.findFunctions(command.code);

        command.__path__ = PATH.sep + command.name + ".js";

        const debug = {
            code,
            functions: command.functions,
        };

        if (command["$if"] === "old") {
            code = (
                await IF({
                    client,
                    code,
                    message,
                    channel,
                    args,
                    data: {
                        randoms: randoms,
                        command: {
                            name: command.name,
                            code: code,
                            error: command.error,
                            async: command.async || false,
                            functions: command.functions,
                            __path__: command.__path__,
                            codeLines: command.codeLines,
                            funcLine: funcLine,
                        },
                        helpers: {
                            time: Time,
                            checkCondition: CheckCondition,
                            mustEscape,
                        },
                        args: args,
                        aoiError: require("./classes/AoiError.js"),
                        data: data,
                        func: undefined,
                        funcLine: undefined,
                        util: Util,
                        allowedMentions: allowedMentions,
                        embeds: embeds || [],
                        components: components,
                        files: attachments || [],
                        timezone: timezone,
                        channelUsed: channelUsed,
                        vars: letVars,
                        object: object,
                        disableMentions: disableMentions,
                        returnID: returnID,
                        array: array,
                        arrays,
                        reactions: reactions,
                        message: message.message || message,
                        msg: msg.message || msg,
                        author: author,
                        guild: guild,
                        channel: channel,
                        member: member,
                        mentions: mentions,
                        unpack() {
                            const last = code.split(this.func.replace("[", "")).length - 1;
                            return code.split(this.func.replace("[", ""))[last].after();
                        },
                        inside(unpacked) {
                            if (typeof unpacked.inside !== "string") {
                                if (suppressErrors) return suppressErrors;
                                else {
                                    return client.aoiOptions.suppressAllErrors
                                        ? client.aoiOptions.errorMessage
                                        : `\`AoiError: ${this.func}: Invalid Usage (line : ${funcLine})\``;
                                }
                            } else return false;
                        },
                        noop() {},
                        interpreter: Interpreter,
                        client: client,
                        embed: Discord.EmbedBuilder,
                    },
                })
            ).code;

            funcs = client.functionManager.findFunctions(code);
        }

        console.log(data);

        for (let i = funcs.length; i > 0; i--) {
            if (!funcs.length) break;

            if (i > funcs.length && funcs.length !== 0) i = funcs.length;

            let func = funcs[i - 1];

            if (error) break;
            const regex = new RegExp("\\" + func.replace("[", "\\["), "gi");

            code = code.replace(regex, func);
            debug[func] = { regex, func };
            command.codeLines?.map((x) => x.replace(regex, func));
            funcLine =
                command.codeLines.length -
                command.codeLines
                    ?.reverse()
                    .findIndex((x) =>
                        x.toLowerCase().split(" ").includes(func.toLowerCase())
                    );

            const functionObj = client.functionManager.cache.get(
                func.replace("$", "").replace("[", "")
            );

            if (
                functionObj instanceof CustomFunction &&
                functionObj.type === "aoi.js"
            ) {
                const d = { ...functionObj };
                let param = [];

                for (let p = functionObj.params.length - 1; p >= 0; p--) {
                    d.code = d.code.replace(
                        `{${functionObj.params[p]}}`,
                        unpack(code, func).splits[p]
                    );
                    param.push(functionObj.params[p]);
                }

                FuncData = await client.functionManager.interpreter(
                    client,
                    message,
                    args,
                    d,
                    client.db,
                    true,
                    channelUsed,
                    data
                );

                if (FuncData.error) {
                    errorOccurred = true;
                    error = FuncData.error;
                    break;
                }

                if (FuncData.returnCode) {
                    return FuncData.returnCode;
                }

                if (FuncData.returnMessage) {
                    returnMessage = FuncData.returnMessage;
                }

                if (FuncData.returnExecution) {
                    returnExecution = FuncData.returnExecution;
                }

                if (FuncData.returnID) {
                    returnID = FuncData.returnID;
                }

                if (FuncData.embeds) {
                    embeds = FuncData.embeds;
                }

                if (FuncData.components) {
                    components = FuncData.components;
                }

                if (FuncData.files) {
                    files = FuncData.files;
                }

                if (FuncData.mentions) {
                    mentions = FuncData.mentions;
                }
            } else {
                // Not a function
            }
        }

        console.log(FuncData);

        if (errorOccurred) {
            return {
                error: error,
                returnMessage: returnMessage,
                returnExecution: returnExecution,
                returnID: returnID,
                embeds: embeds,
                components: components,
                files: files,
                mentions: mentions,
            };
        }

        return {
            result: code,
            returnMessage: returnMessage,
            returnExecution: returnExecution,
            returnID: returnID,
            embeds: embeds,
            components: components,
            files: files,
            mentions: mentions,
        };
    } catch (error) {
        return {
            error: error.message,
            returnMessage: returnMessage,
            returnExecution: returnExecution,
            returnID: returnID,
            embeds: embeds,
            components: components,
            files: files,
            mentions: mentions,
        };
    }
}

module.exports = Interpreter
