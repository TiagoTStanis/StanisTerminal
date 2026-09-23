// Regras de realce do ChromaTerm (https://github.com/hSaria/ChromaTerm), licença MIT, Copyright (c) 2020 Saria H.
// Arquivo GERADO por scripts de conversão a partir de chromaterm/default_config.py e contrib/rules/{cisco,
// generic-networking,juniper}.yml: não edite à mão. Regex convertidas de Python para JavaScript ((?i) vira a
// flag "i", o modo verboso (?x) teve espaços/comentários removidos, (?P<n>) vira (?<n>)).
export const RULE_SETS = {
 "default": [
  {
   "name": "Numbers",
   "source": "\\b(?<!\\.)\\d+(\\.\\d+)?(?!\\.)\\b",
   "flags": "",
   "fg": "dc8968",
   "exclusive": false
  },
  {
   "name": "URL",
   "source": "\\b((htt|ft|lda)ps?|telnet|ssh)://([-%:\\w\\\\/]{1,256}@)?[-\\w]{1,63}(\\.[-\\w]{1,63}){0,126}(:\\d{1,5})?(/[-+=~@%&?#.:;,\\w\\\\/()]*)?((?=[.:;,)])|\\b)",
   "flags": "i",
   "fg": "5698c8",
   "exclusive": true
  },
  {
   "name": "IPv4",
   "source": "\\b(?<!\\.)((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)(/\\d+)?\\b",
   "flags": "",
   "fg": "00e0d1",
   "exclusive": true
  },
  {
   "name": "IPv6",
   "source": "(?<![\\w:])(([\\da-f]{1,4}:){7}[\\da-f]{1,4}|[\\da-f]{1,4}:(:[\\da-f]{1,4}){1,6}|([\\da-f]{1,4}:){1,2}(:[\\da-f]{1,4}){1,5}|([\\da-f]{1,4}:){1,3}(:[\\da-f]{1,4}){1,4}|([\\da-f]{1,4}:){1,4}(:[\\da-f]{1,4}){1,3}|([\\da-f]{1,4}:){1,5}(:[\\da-f]{1,4}){1,2}|([\\da-f]{1,4}:){1,6}:[\\da-f]{1,4}|([\\da-f]{1,4}:){1,7}:|:((:[\\da-f]{1,4}){1,7}|:))(:(?=\\W))?(%[\\da-z]+)?(/\\d+)?(?!:?\\w)",
   "flags": "i",
   "fg": "ef2e9f",
   "exclusive": true
  },
  {
   "name": "MAC address",
   "source": "\\b((?<!:)([\\da-f]{1,2}:){5}[\\da-f]{1,2}(?!:)|(?<!\\.)([\\da-f]{4}\\.){2}[\\da-f]{4}(?!\\.))\\b",
   "flags": "i",
   "fg": "5698c8",
   "exclusive": true
  },
  {
   "name": "Date",
   "source": "\\b((\\d{2}|\\d{4})(?<sep1>[-/])(0?[1-9]|1[0-2])\\k<sep1>(3[0-1]|[1-2]\\d|0?[1-9])|(3[0-1]|[1-2]\\d|0?[1-9])(?<sep2>[-/])(0?[1-9]|1[0-2])\\k<sep2>(\\d{2}|\\d{4})|(0?[1-9]|1[0-2])(?<sep3>[-/])(3[0-1]|[1-2]\\d|0?[1-9])\\k<sep3>(\\d{2}|\\d{4})|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\\s+((3[0-1]|[1-2]\\d|0?[1-9])(\\s+\\d{4})?|\\d{4})|(3[0-1]|[1-2]\\d|0?[1-9])\\s(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?!\\s+(3[0-1]|[1-2]\\d|0?[1-9])([^\\w:]|$))(\\s+\\d{4})?)((?=[\\WT_])|$)",
   "flags": "i",
   "bg": "a35a00",
   "exclusive": true
  },
  {
   "name": "Time",
   "source": "(?<![\\.:])(\\b|(?<=T))(2[0-3]|[0-1]\\d):[0-5]\\d(:[0-5]\\d([\\.,]\\d{3,6})?)?([\\-\\+](\\d{2}|\\d{4})|Z)?(?![\\.:])\\b",
   "flags": "i",
   "bg": "a35a00",
   "exclusive": true
  },
  {
   "name": "Size, like 123G 123Gb 123Gib 1.23G 123Gbps",
   "source": "\\b\\d+(\\.\\d+)?\\s?((([KMGTPEZY](i?B)?)|B)(ps)?)\\b",
   "flags": "i",
   "fg": "df99f0",
   "exclusive": true
  },
  {
   "name": "Generic - Bad",
   "source": "\\b(password|abnormal(ly)?|down|los(t|ing)|err(ors?)?|(den(y|ies|ied)?)|reject(ing|ed)?|drop(ped|s)?|(err\\-)?disabled?|(timed?\\-?out)|fail(s|ed|iure)?|disconnect(ed)?|unreachable|invalid|bad|notconnect|unusable|blk|inaccessible|wrong|collisions?|unsynchronized|mismatch|runts)\\b",
   "flags": "i",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Generic - Ambigious bad",
   "source": "\\b(no(pe)?|exit(ed)?|reset(t?ing)?|discard(ed|ing)?|block(ed|ing)?|filter(ed|ing)?|stop(p(ed|ing))?|never|bad)\\b",
   "flags": "i",
   "fg": "ca9102",
   "exclusive": false
  },
  {
   "name": "Generic - Not too bad",
   "source": "\\b(warnings?)\\b",
   "flags": "i",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "Generic - Ambigious good",
   "source": "\\b(ye(s|ah?|p)?|start(ed|ing)?|running|good)\\b",
   "flags": "i",
   "fg": "79bf02",
   "exclusive": false
  },
  {
   "name": "Generic - Good",
   "source": "\\b(up|ok(ay)?|permit(ed|s)?|accept(s|ed)?|enabled?|online|succe((ss(ful|fully)?)|ed(ed)?)?|connect(ed)?|reachable|valid|forwarding|synchronized)\\b",
   "flags": "i",
   "fg": "28c501",
   "exclusive": false
  }
 ],
 "cisco": [
  {
   "name": "IP-address:nn RD or RT",
   "source": "\\b(RT:)?((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d):[1-9]\\d{0,4}\\b",
   "flags": "",
   "fg": "00e0d1",
   "exclusive": true
  },
  {
   "name": "VPNv4 Addresses",
   "source": "\\b((\\d{1,10}:){2}((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)|((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d):\\d{1,10}:((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d))\\b",
   "flags": "",
   "fg": "00e0d1",
   "exclusive": true
  },
  {
   "name": "VPNv6 Addresses",
   "source": "\\[(\\d{1,10}|\\d{1,3}(\\.\\d{1,3}){3}):\\d{1,10}\\](([\\da-f]{1,4}:){7}[\\da-f]{1,4}|[\\da-f]{1,4}:(:[\\da-f]{1,4}){1,6}|([\\da-f]{1,4}:){1,2}(:[\\da-f]{1,4}){1,5}|([\\da-f]{1,4}:){1,3}(:[\\da-f]{1,4}){1,4}|([\\da-f]{1,4}:){1,4}(:[\\da-f]{1,4}){1,3}|([\\da-f]{1,4}:){1,5}(:[\\da-f]{1,4}){1,2}|([\\da-f]{1,4}:){1,6}:[\\da-f]{1,4}|([\\da-f]{1,4}:){1,7}:|:((:[\\da-f]{1,4}){1,7}|:)|::(ffff(:0{1,4})?:)?((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)|([\\da-f]{1,4}:){1,4}:((25[0-5]|(2[0-4]|[0-1]?\\d)?\\d)\\.){3}(25[0-5]|(2[0-4]|[0-1]?\\d)?\\d))(?![:.\\w])",
   "flags": "i",
   "fg": "ef2e9f",
   "exclusive": true
  },
  {
   "name": "Uptime, like 10d23h 5w3d",
   "source": "\\b(\\d{1,5}w\\dd|\\d{1,5}d\\d{1,2}h)\\b",
   "flags": "",
   "bg": "a35a00",
   "exclusive": false
  },
  {
   "name": "Interfaces",
   "source": "\\b(((Hu(ndredGigabit)?|Fo(rtyGigabit)?|Te(nGigabit)?|Gi(gabit)?|Fa(st)?)(Ethernet)?)|Eth|Se(rial)?|Lo(opback)?|Tu(nnel)?|VL(AN)?|Po(rt-channel)?|Vi(rtual\\-(Template|Access))?|Mu(ltilink)?|Di(aler)?|[BN]VI)(\\d+/){0,2}\\d+(\\.\\d+)?\\b",
   "flags": "i",
   "fg": "03d28d",
   "exclusive": true
  },
  {
   "name": "Bad responses",
   "source": "\\b(administratively|down|Down|DOWN|fail|failed|not|not active|not activated|bad|never|BLK|fddi|n\\-isl|isl|notconnect|blocking|\\(tdp\\)|tdp|TDP|denied|invalid|err\\-disabled|disabled|unusable|DENIED|err\\-disable|infinity|inaccessible|wrong|cannot|MM_NO_STATE|MM_KEY_EXCH|UP\\-NO\\-IKE|K[13]=(\\d{2,3}|[02-9])|K[245]=[1-9]\\d{0,2})\\b",
   "flags": "",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Good responses",
   "source": "\\b(rstp|best|our_master|UP\\-ACTIVE|\\*\\>|root|Root|802\\.1q|connected|LocalT|yes|forwarding|synchronized|active|rapid\\-pvst|up|Up|UP)\\b",
   "flags": "",
   "fg": "28c501",
   "exclusive": false
  },
  {
   "name": "Possible warning and other things that deserve attention",
   "source": "\\b(Total output drops:\\s[1-9]\\d*|[1-9]\\d* ((input |output )?errors|runts|CRC|(late )?collisions|unknown protocol drops)|err(ors?)?|reset|act\\/unsup|dhcp|DHCP|mismatch|notconnect|dropped|LRN|learning|listening|LIS|unsynchronized|Peer\\(STP\\)|Shr|Edge|pvst|ieee|Bound\\(PVST\\)|TFTP|Mbgp|LAPB|l2ckt\\(\\d{1,10}\\)|D[CT]E|passive|r |RIB\\-failure|discriminator|Standby|aggregate(d|\\/\\w+)|atomic\\-aggregate|\\(global\\)|tag|key-chain|md5|backup\\/repair|repair|v2\\/S?D|Condition\\-map|Advertise\\-map|no\\-advertise|no\\-export|local\\-AS|internet)\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "Syslog facilities - Emergency to error",
   "source": "\\b%\\w+\\-[0-3]\\-\\w+\\b",
   "flags": "",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Syslog facilities - Warning to notice",
   "source": "\\b%\\w+\\-[4-5]\\-\\w+\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "Syslog facilities - Info to debug",
   "source": "\\b%\\w+\\-[6-7]\\-\\w+\\b",
   "flags": "",
   "fg": "65d7fd",
   "exclusive": false
  },
  {
   "name": "BGP",
   "source": "\\b(Cost:pre\\-bestpath|0x880\\d):\\d{1,10}:\\d{1,10}\\b",
   "flags": "",
   "fg": "cfbaba",
   "exclusive": false
  },
  {
   "name": "BGP Part 2",
   "source": "\\b(%BGP(_SESSION)?\\-\\d\\-\\w+|bgp|BGP|B|IGP|incomplete|\\d{2,7}\\/nolabel\\(\\w+\\)|RR\\-client|Originator|cluster\\-id|Cluster\\-id|Cluster|Route\\-Reflector)\\b",
   "flags": "",
   "fg": "4c61ff",
   "exclusive": false
  },
  {
   "name": "OSPFv2 and OSPFv3",
   "source": "\\b(OSPF_VL\\d{1,2}|OSPF_SL\\d{1,2}|VL\\d{1,2}|SL\\d{1,2}|Type\\-\\d|ospf|OSPF|O|IA|E[12]|N[12]|P2P|P2MP|BDR|DR|ABR|ASBR|LOOP|DROTHER|POINT_TO_POINT|POINT_TO_MULTIPOINT|BROADCAST|NON_BROADCAST|LOOPBACK|SHAM_LINK|3101|1587|transit|Transit|nssa|NSSA|stub|Stub|Superbackbone|OSPFv3_VL\\d{1,2}|OSPFv3\\-\\d{1,5}\\-IPv6|ospfv3|OSPFv3|OI|OE[12]|ON[12]|V6\\-Bit|E\\-Bit|R\\-bit|DC\\-Bit|opaque|DROTH|%OSPF(V3)?\\-\\d\\-\\w+)\\b",
   "flags": "",
   "fg": "ff8c00",
   "exclusive": false
  },
  {
   "name": "EIGRP",
   "source": "\\b(EIGRP\\-IPv6|EIGRP\\-IPv4|eigrp|EIGRP|EX|D|K[13]=1|K[245]=0|Internal|External|%DUAL\\-\\d\\-\\w+)\\b",
   "flags": "",
   "fg": "008080",
   "exclusive": false
  },
  {
   "name": "RIP",
   "source": "\\b(rip|R(IP)?)\\b",
   "flags": "",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Multicast",
   "source": "\\b((PIM\\/IPv4|RP\\:|v2\\/S|BSR)|%(PIM|MSDP|IGMP)\\-\\d\\-\\w+)\\b",
   "flags": "",
   "fg": "ef2e9f",
   "exclusive": false
  },
  {
   "name": "LDP",
   "source": "\\b%(LDP|LSD)\\-\\d\\-\\w+\\b",
   "flags": "",
   "fg": "ef2e9f",
   "exclusive": false
  },
  {
   "name": "IPv6 Neighbor Discovery",
   "source": "\\b%IPV6_ND\\-\\d\\-\\w+\\b",
   "flags": "",
   "fg": "ef2e9f",
   "exclusive": false
  },
  {
   "name": "Routing table metrics",
   "source": "\\b\\[\\d{1,3}\\/\\d{1,12}\\]\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "EIGRP topology table metrics and ping responses",
   "source": "\\b\\(\\d{1,12}\\/\\d{1,12}\\)\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "Prompt",
   "source": "^[\\w-]+(\\(\\w+\\))?[$#>]",
   "flags": "",
   "fg": "87d700",
   "exclusive": false
  }
 ],
 "networking": [
  {
   "name": "Half-duplex",
   "source": "\\bhalf\\-?duplex\\b",
   "flags": "i",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Spanning tree - Problematic states",
   "source": "\\b(BKN|(LOOP|ROOT|TYPE|PVID)_Inc)\\b",
   "flags": "",
   "fg": "c71800",
   "exclusive": false
  },
  {
   "name": "Spanning tree - Forwarding states",
   "source": "\\b(FWD|Root|Desg)\\b",
   "flags": "",
   "fg": "28c501",
   "exclusive": false
  },
  {
   "name": "OSPF - Transitional states",
   "source": "\\b(ATTEMPT|INIT|EXCHANGE|LOADING)\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  },
  {
   "name": "OSPF - Acceptable states",
   "source": "\\b(2WAY|FULL)\\b",
   "flags": "",
   "fg": "28c501",
   "exclusive": false
  },
  {
   "name": "BGP - Transitional states",
   "source": "\\b(Idle|Connect|Active|OpenSent|OpenConfirm)\\b",
   "flags": "",
   "fg": "cab902",
   "exclusive": false
  }
 ],
 "juniper": [
  {
   "name": "Interfaces",
   "source": "\\b(([fgx]e|et|gr|ip|[lm]t|lsq|sp|vcp)\\-\\d+/\\d+/\\d+|((b?me|em|fab|fxp|fti|lo|pp[de]?|st|swfab)[0-2]|dsc|gre|ipip|irb|jsrv|lsi|mtun|pim[de]|tap|vlan|vme|vtep)|(ae|reth)\\d*)(\\.\\d+)?\\b",
   "flags": "i",
   "fg": "03d28d",
   "exclusive": true
  }
 ]
};
