const SDK = globalThis.SDK;
const lang = globalThis.lang;

const PLUGIN_ID = "Spriter";
const PLUGIN_CATEGORY = "general";

const PLUGIN_CLASS = SDK.Plugins.Spriter = class Spriter extends SDK.IPluginBase
{
        constructor()
        {
                super(PLUGIN_ID);

                SDK.Lang.PushContext("plugins." + PLUGIN_ID.toLowerCase());

                this._info.SetName(lang(".name"));
                this._info.SetDescription(lang(".description"));
                this._info.SetCategory(PLUGIN_CATEGORY);
                this._info.SetAuthor("BrashMonkey");
                this._info.SetHelpUrl(lang(".help-url"));
                this._info.SetPluginType("world");
                this._info.SetIsResizable(true);
                this._info.SetIsRotatable(true);
                this._info.SetHasAnimations(true);
                this._info.SetIsTiled(false);
                this._info.SetIsSingleGlobal(false);
                this._info.SetSupportsEffects(true);
                this._info.SetMustPreDraw(true);
                this._info.SetCanBeBundled(false);
                this._info.SetRuntimeModuleMainScript("c3runtime/main.js");

                this._info.AddCommonPositionACEs();
                this._info.AddCommonAngleACEs();
                this._info.AddCommonAppearanceACEs();
                this._info.AddCommonZOrderACEs();
                this._info.AddCommonSceneGraphACEs();

                SDK.Lang.PushContext(".properties");

                this._info.SetProperties([
                        new SDK.PluginProperty("text", "scml-file", ""),
                        new SDK.PluginProperty("text", "starting-entity", ""),
                        new SDK.PluginProperty("text", "starting-animation", ""),
                        new SDK.PluginProperty("float", "starting-opacity", 100),
                        new SDK.PluginProperty("combo", "draw-self",
                        {
                                initialValue: "false",
                                items: ["false", "true"]
                        }
                        ),
                        new SDK.PluginProperty("text", "nickname-in-c2", ""),
                        new SDK.PluginProperty("combo", "blend-mode",
                        {
                                initialValue: "use effects blend mode",
                                items: ["no premultiplied alpha blend", "use effects blend mode"]
                        }
                        )
                ]);

                SDK.Lang.PopContext();  // .properties

                SDK.Lang.PopContext();
        }
};

PLUGIN_CLASS.Register(PLUGIN_ID, PLUGIN_CLASS);
