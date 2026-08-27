// Broad economic period a date falls into, plus a plain-English description.
// Ported verbatim from api/main.py's _historical_context() (itself copied
// from app.py's get_historical_context()) — this is a static lookup by year,
// never live data, so it lives here rather than behind a network call.
export function getHistoricalContext(dateStr) {
  const year = new Date(dateStr + 'T00:00:00').getFullYear()

  if (year < 2007) {
    return {
      title: 'Pre-2007: The "Great Moderation"',
      description:
        'Before 2007, the global economy had enjoyed roughly two decades of ' +
        'low inflation, steady growth and low volatility — economists nicknamed ' +
        'this the "Great Moderation". Central banks like the US Federal Reserve ' +
        'were gradually raising interest rates back to more normal levels after ' +
        'cutting them to deal with the early-2000s dot-com bust. Yield curves in ' +
        'this period tended to look fairly typical (upward-sloping), reflecting ' +
        'broad confidence that growth would continue.',
      color: 'blue',
    }
  } else if (year >= 2007 && year <= 2009) {
    return {
      title: '2007–2009: The Global Financial Crisis',
      description:
        'This period covers the build-up to and aftermath of the Global ' +
        'Financial Crisis, triggered by the collapse of the US subprime ' +
        'mortgage market and the failure of major banks like Lehman Brothers. ' +
        'Central banks slashed interest rates to near zero in emergency moves ' +
        'to stop the financial system from seizing up, and the US Federal ' +
        'Reserve began "quantitative easing" (QE) — buying government bonds to ' +
        'push money into the economy and pull long-term yields down.',
      color: 'orange',
    }
  } else if (year >= 2010 && year <= 2015) {
    return {
      title: '2010–2015: Post-Crisis Recovery',
      description:
        'In the years after the crisis, central banks kept interest rates near ' +
        'zero — a "zero interest rate policy", or ZIRP — to encourage borrowing ' +
        'and support a fragile recovery. At the same time, several eurozone ' +
        'countries struggled with unsustainable government debt, causing the ' +
        'European debt crisis and pushing their bond yields sharply higher. ' +
        'Yield curves in the US, UK and Germany stayed generally normal but very ' +
        'flat at the short end, since near-zero policy rates anchored short-term ' +
        'yields for years.',
      color: 'blue',
    }
  } else if (year >= 2016 && year <= 2019) {
    return {
      title: '2016–2019: Gradual Normalisation',
      description:
        'As the recovery matured, the US Federal Reserve began slowly raising ' +
        'interest rates back towards more typical levels, a process known as ' +
        '"policy normalisation". Growth expectations stayed modest and inflation ' +
        "stayed low, so long-term yields didn't rise much even as short-term " +
        'yields climbed — this flattened the US yield curve, which briefly ' +
        'inverted in parts during 2019 and was widely watched as an early ' +
        'warning sign of a possible slowdown.',
      color: 'blue',
    }
  } else if (year === 2020) {
    return {
      title: '2020: The COVID-19 Shock',
      description:
        'When COVID-19 triggered a sudden, severe global shutdown in March ' +
        '2020, central banks cut interest rates to zero almost overnight and ' +
        'launched enormous QE programmes to keep credit markets functioning. ' +
        'Short-term yields collapsed to near zero, while massive government ' +
        'borrowing and eventual hopes of recovery kept longer-term yields ' +
        'comparatively higher, so yield curves steepened sharply — a normal ' +
        'shape, but for crisis-driven reasons rather than confident growth.',
      color: 'orange',
    }
  } else if (year === 2021) {
    return {
      title: '2021: Recovery and Rising Inflation',
      description:
        'As economies reopened and stimulus spending flowed through the ' +
        'system, growth rebounded strongly — but so did inflation, partly due ' +
        'to supply-chain bottlenecks and surging demand. Markets began pricing ' +
        'in the likelihood that central banks would soon need to raise interest ' +
        'rates to bring inflation back under control, which started pushing ' +
        'short- and medium-term yields upward through the year.',
      color: 'blue',
    }
  } else if (year >= 2022 && year <= 2023) {
    return {
      title: '2022–2023: The Fastest Rate Hike Cycle in 40 Years',
      description:
        'To fight the highest inflation since the early 1980s, central banks — ' +
        'especially the US Federal Reserve — raised interest rates at the ' +
        'fastest pace in decades. Short-term yields shot up faster than ' +
        'long-term yields, because markets expected the hikes to eventually ' +
        'cause a slowdown and future rate cuts, producing a deep inversion of ' +
        'the US yield curve and widespread recession fears. The Bank of Japan ' +
        'was the major outlier through all of this, keeping rates near zero ' +
        'and defending its yield curve control policy while every other major ' +
        'central bank hiked aggressively.',
      color: 'red',
    }
  } else {
    return {
      title: '2024–2025: The Rate Cut Cycle Begins',
      description:
        'With inflation cooling from its 2022 peak, central banks started ' +
        'cutting interest rates again, moving cautiously to avoid reigniting ' +
        'price pressures or tipping the economy into recession. As cuts got ' +
        'underway, short-term yields began falling faster than long-term ' +
        'yields, and previously inverted curves started to "re-normalise" — ' +
        'moving back towards their typical upward-sloping shape. Meanwhile the ' +
        'Bank of Japan moved the opposite way, finally abandoning yield curve ' +
        'control and raising rates for the first time in decades.',
      color: 'blue',
    }
  }
}
