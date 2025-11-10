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
  PiSealCheckFill,
  PiAddressBookFill
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
  trend: PiChartLineUp,
  cafe: PiCoffee,
  refresh: PiArrowClockwise,
  gear: PiGear,
  user: PiUser,
  userFill: PiUserFill,
  eyesFill: PiEyesFill,
  currencyJpyFill: PiCurrencyJpyFill,
  calendarSimple: PiCalendarFill,
  heart: PiHeart,
  sealCheck: PiSealCheckFill,
  wechatLogo: PiAddressBookFill
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
