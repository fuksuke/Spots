import type { IconBaseProps } from "react-icons";
import {
  PiArrowClockwise,
  PiBell,
  PiCalendarDots,
  PiCameraPlus,
  PiChartLineUp,
  PiCoffee,
  PiGlobe,
  PiGlobeHemisphereEastDuotone,
  PiHouse,
  PiMagnifyingGlassBold,
  PiMapPinArea,
  PiMapPinFill,
  PiMusicNoteFill,
  PiPlus,
  PiTextOutdentLight,
  PiListBullets,
  PiGear,
  PiUser,
  PiUserFill,
  PiEyesFill,
  PiCurrencyJpyFill,
  PiCalendarFill,
  PiHeart,
  PiHeartFill,
  PiSealCheckFill,
  PiAddressBookFill,
  PiSpeakerSimpleHighFill,
  PiInstagramLogo,
  PiXLogo,
  PiCheck,
  PiYoutubeLogo,
  PiFacebookLogo,
  PiLineSegments,
  PiBoundingBox
} from "react-icons/pi";

const ICONS = {
  globe: PiGlobe,
  search: PiMagnifyingGlassBold,
  add: PiPlus,
  bell: PiBell,
  map: PiMapPinArea,
  mapLight: PiMapPinFill,
  home: PiHouse,
  pin: PiGlobeHemisphereEastDuotone,
  music: PiMusicNoteFill,
  list: PiTextOutdentLight,
  menu: PiListBullets,
  calendar: PiCalendarDots,
  camera: PiCameraPlus,
  trend: PiLineSegments,
  cafe: PiCoffee,
  refresh: PiArrowClockwise,
  gear: PiGear,
  user: PiUser,
  userFill: PiUserFill,
  eyesFill: PiEyesFill,
  currencyJpyFill: PiCurrencyJpyFill,
  calendarSimple: PiCalendarFill,
  heart: PiHeart,
  heartFill: PiHeartFill,
  sealCheck: PiSealCheckFill,
  wechatLogo: PiAddressBookFill,
  speakerHigh: PiSpeakerSimpleHighFill,
  instagram: PiInstagramLogo,
  x: PiXLogo,
  check: PiCheck,
  youtube: PiYoutubeLogo,
  facebook: PiFacebookLogo,
  boundingBox: PiBoundingBox
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = Omit<IconBaseProps, "aria-label"> & {
  name: IconName;
  label?: string;
  wrapperClassName?: string;
};

export const Icon = ({
  name,
  label,
  size = 20,
  color = "currentColor",
  wrapperClassName,
  ...rest
}: IconProps) => {
  const IconComponent = ICONS[name];

  return (
    <span
      className={["icon", wrapperClassName].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <IconComponent size={size} color={color} aria-hidden={label ? undefined : true} {...rest} />
    </span>
  );
};
